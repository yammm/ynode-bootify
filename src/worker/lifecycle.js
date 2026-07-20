/**
 * @fileoverview worker/lifecycle.js: Worker signal/message lifecycle wiring.
 */

import cluster from "node:cluster";
import os from "node:os";

import { off } from "../events.js";

const WORKER_SHUTDOWN_SIGNALS = ["SIGINT", "SIGTERM", "SIGQUIT", "SIGUSR2"].filter((signal) =>
    Object.hasOwn(os.constants.signals ?? {}, signal),
);

/**
 * Formats the server's bound address for display in log messages.
 * @param {object} server - Node.js HTTP/HTTPS server.
 * @returns {string} Formatted address string (e.g. "127.0.0.1:3000" or "[::1]:3000").
 */
export function resolveListenAddress(server) {
    const address = server.address();
    if (typeof address === "string") {
        return address;
    }
    if (!address || typeof address !== "object") {
        return "";
    }
    if (address.family === "IPv6") {
        return `[${address.address}]:${address.port}`;
    }
    return `${address.address}:${address.port}`;
}

/**
 * Wires up signal handlers, worker message handling, and graceful shutdown
 * orchestration for a worker process.
 * @param {object} options
 * @param {object} options.fastify - Fastify instance.
 * @param {object} options.config - Application configuration.
 * @param {object} options.pkg - Package.json content.
 * @param {object} [options.hooks] - Lifecycle hooks (onShutdown).
 * @param {object} [options.signalTarget] - EventEmitter for signal listeners (default: process).
 * @param {object} [options.processTarget] - Process-like target for worker exit (default: signalTarget).
 * @param {object} [options.worker] - Cluster worker instance (default: cluster.worker).
 * @returns {{ lifecycleContext: object, gracefulShutdown: function(string=): Promise<void>, dispose: function(): void }}
 */
export function createLifecycleController({
    fastify,
    config,
    pkg,
    hooks = {},
    signalTarget = process,
    processTarget = signalTarget,
    worker = cluster.worker,
}) {
    const lifecycleContext = { fastify, config, pkg };

    let shutdownPromise = null;
    const gracefulShutdown = async (signal) => {
        if (!shutdownPromise) {
            shutdownPromise = (async () => {
                // Drop out of the cluster master's round-robin pool and
                // evict every existing client connection before Fastify
                // flips into closing-state. fastify.close() does these
                // eventually, but only after preClose hooks (Mongoose,
                // Redis, etc.) finish — and during that window the router
                // rejects every keep-alive request with 503. Doing it up
                // front means clients reconnect cleanly to a healthy
                // worker instead.
                if (fastify.server?.listening) {
                    try {
                        fastify.server.close();
                    } catch (ex) {
                        fastify.log.warn({ err: ex }, "Pre-shutdown server.close() failed");
                    }
                    if (typeof fastify.server.closeAllConnections === "function") {
                        try {
                            fastify.server.closeAllConnections();
                        } catch (ex) {
                            fastify.log.warn(
                                { err: ex },
                                "Pre-shutdown closeAllConnections() failed",
                            );
                        }
                    }
                }

                let hookError = null;
                if (typeof hooks.onShutdown === "function") {
                    try {
                        await hooks.onShutdown({ ...lifecycleContext, signal });
                    } catch (ex) {
                        hookError = ex;
                    }
                }

                let closeError = null;
                try {
                    await fastify.close();
                } catch (ex) {
                    closeError = ex;
                }

                if (hookError && closeError) {
                    throw new AggregateError([hookError, closeError], "Multiple shutdown errors.");
                }

                if (hookError) {
                    throw hookError;
                }

                if (closeError) {
                    throw closeError;
                }
            })();
        }
        return shutdownPromise;
    };

    const configuredShutdownTimeout = config.cluster?.shutdownTimeout;
    const shutdownTimeout =
        Number.isFinite(configuredShutdownTimeout) && configuredShutdownTimeout >= 0
            ? configuredShutdownTimeout
            : 10000;
    let exitAfterShutdown = false;
    let terminationPromise = null;

    const shutdownWorker = async (signal, { exitAfter = false } = {}) => {
        exitAfterShutdown ||= exitAfter;
        if (!terminationPromise) {
            terminationPromise = (async () => {
                let shutdownError = null;
                let timeout = null;
                try {
                    const timeoutPromise = new Promise((_, reject) => {
                        timeout = setTimeout(() => {
                            reject(
                                new Error(
                                    `Worker shutdown after ${signal} exceeded ${shutdownTimeout}ms`,
                                ),
                            );
                        }, shutdownTimeout);
                        timeout.unref();
                    });
                    await Promise.race([gracefulShutdown(signal), timeoutPromise]);
                } catch (ex) {
                    shutdownError = ex;
                    fastify.log.error(ex, `Error during shutdown after ${signal}`);
                } finally {
                    if (timeout) {
                        clearTimeout(timeout);
                    }
                }

                if (worker && (typeof worker.isConnected !== "function" || worker.isConnected())) {
                    try {
                        worker.disconnect();
                    } catch (ex) {
                        shutdownError ??= ex;
                        fastify.log.error(ex, "Failed to disconnect cluster worker after shutdown");
                    }
                }

                if (
                    (exitAfterShutdown || shutdownError) &&
                    typeof processTarget.exit === "function"
                ) {
                    processTarget.exit(shutdownError ? 1 : 0);
                } else if (shutdownError && "exitCode" in processTarget) {
                    processTarget.exitCode = 1;
                }
            })();
        }
        return terminationPromise;
    };

    const signalHandlers = new Map();
    for (const signal of WORKER_SHUTDOWN_SIGNALS) {
        const handler = () => {
            if (terminationPromise && typeof processTarget.exit === "function") {
                fastify.log.warn(`Received ${signal} again; forcing worker exit.`);
                processTarget.exit(1);
                return;
            }
            void shutdownWorker(signal, { exitAfter: true });
        };
        signalHandlers.set(signal, handler);
        signalTarget.on(signal, handler);
    }

    let workerMessageHandler = null;
    if (worker) {
        workerMessageHandler = async (msg) => {
            if (msg && typeof msg === "object") {
                if (msg.cmd === "cluster-count") {
                    if (Number.isInteger(msg.count) && msg.count >= 0) {
                        fastify.clusterCount = msg.count;
                    } else {
                        fastify.log.warn(
                            { count: msg.count },
                            "Ignoring invalid cluster-count message payload.",
                        );
                    }
                    if (Number.isInteger(msg.minWorkers) && msg.minWorkers > 0) {
                        fastify.clusterMinWorkers = msg.minWorkers;
                    }
                    if (Number.isInteger(msg.maxWorkers) && msg.maxWorkers > 0) {
                        fastify.clusterMaxWorkers = msg.maxWorkers;
                    }
                    if (msg.mode === "smart" || msg.mode === "max") {
                        fastify.clusterMode = msg.mode;
                    }
                    return;
                }

                if (msg.cmd === "ping") {
                    worker.send({ cmd: "ping", ts: Date.now() });
                    return;
                }

                if (msg.cmd === "version") {
                    worker.send({
                        cmd: "version",
                        appVersion: pkg?.version ?? null,
                        nodeVersion: process.version,
                    });
                    return;
                }
            }

            if (msg === "shutdown") {
                await shutdownWorker("shutdown");
            }
        };

        worker.on("message", workerMessageHandler);
    }

    // dispose is wired into both fastify.onClose (via start.js) and
    // start.js's own try/finally cleanup path, so it can fire twice in
    // the same shutdown. Today the double-call is safe by coincidence
    // (off() on an already-removed listener is a no-op), but a flag
    // future-proofs this against any side effect that might be added.
    let disposed = false;
    const dispose = () => {
        if (disposed) {
            return;
        }
        disposed = true;
        for (const [signal, handler] of signalHandlers) {
            off(signalTarget, signal, handler);
        }
        if (worker && workerMessageHandler) {
            off(worker, "message", workerMessageHandler);
        }
    };

    return { lifecycleContext, gracefulShutdown, dispose };
}
