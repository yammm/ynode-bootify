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
 * @returns {{ lifecycleContext: object, shutdownSignal: AbortSignal, gracefulShutdown: function(string=): Promise<void>, shutdownWithTimeout: function(string=): Promise<void>, handleAutoShutdownStart: function(object=): Promise<void>, handleFastifyClose: function(): Promise<void>, dispose: function(): void }}
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
    const shutdownController = new AbortController();
    const beginShutdown = () => {
        if (!shutdownController.signal.aborted) {
            shutdownController.abort();
        }
    };

    let shutdownHookPromise = null;
    let shutdownHookErrorHandled = false;
    const runShutdownHook = (signal) => {
        if (!shutdownHookPromise) {
            shutdownHookPromise = Promise.resolve().then(async () => {
                if (typeof hooks.onShutdown === "function") {
                    await hooks.onShutdown({ ...lifecycleContext, signal });
                }
            });
        }
        return shutdownHookPromise;
    };

    let shutdownPromise = null;
    const gracefulShutdown = async (signal) => {
        beginShutdown();
        if (!shutdownPromise) {
            shutdownPromise = (async () => {
                // Drop out of the cluster master's round-robin pool and
                // evict idle keep-alive connections before Fastify
                // flips into closing-state. fastify.close() does these
                // eventually, but only after preClose hooks (Mongoose,
                // Redis, etc.) finish — and during that window the router
                // rejects every keep-alive request with 503. Doing it up
                // front means idle clients reconnect cleanly to a healthy
                // worker while active responses finish draining.
                if (fastify.server?.listening) {
                    try {
                        fastify.server.close();
                    } catch (ex) {
                        fastify.log.warn({ err: ex }, "Pre-shutdown server.close() failed");
                    }
                    if (typeof fastify.server.closeIdleConnections === "function") {
                        try {
                            fastify.server.closeIdleConnections();
                        } catch (ex) {
                            fastify.log.warn(
                                { err: ex },
                                "Pre-shutdown closeIdleConnections() failed",
                            );
                        }
                    }
                }

                let hookError = null;
                try {
                    await runShutdownHook(signal);
                } catch (ex) {
                    hookError = ex;
                    shutdownHookErrorHandled = true;
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

    const shutdownWithTimeout = async (signal) => {
        let timeout = null;
        try {
            const timeoutPromise = new Promise((_, reject) => {
                timeout = setTimeout(() => {
                    reject(
                        new Error(`Worker shutdown after ${signal} exceeded ${shutdownTimeout}ms`),
                    );
                }, shutdownTimeout);
            });
            await Promise.race([gracefulShutdown(signal), timeoutPromise]);
        } finally {
            if (timeout) {
                clearTimeout(timeout);
            }
        }
    };

    let exitAfterShutdown = false;
    let terminationPromise = null;

    const shutdownWorker = async (signal, { exitAfter = false } = {}) => {
        exitAfterShutdown ||= exitAfter;
        if (!terminationPromise) {
            terminationPromise = (async () => {
                let shutdownError = null;
                try {
                    await shutdownWithTimeout(signal);
                } catch (ex) {
                    shutdownError = ex;
                    fastify.log.error(ex, `Error during shutdown after ${signal}`);
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
    let signalReceived = false;
    for (const signal of WORKER_SHUTDOWN_SIGNALS) {
        const handler = () => {
            if (signalReceived && typeof processTarget.exit === "function") {
                fastify.log.warn(`Received ${signal} again; forcing worker exit.`);
                processTarget.exit(1);
                return;
            }
            signalReceived = true;
            void shutdownWorker(signal, { exitAfter: true });
        };
        signalHandlers.set(signal, handler);
        signalTarget.on(signal, handler);
    }

    let workerMessageHandler = null;
    if (worker) {
        const sendWorkerReply = (message) => {
            try {
                worker.send(message, (err) => {
                    if (err) {
                        fastify.log.warn({ err }, `Failed to send worker ${message.cmd} reply.`);
                    }
                });
            } catch (ex) {
                fastify.log.warn({ err: ex }, `Failed to send worker ${message.cmd} reply.`);
            }
        };

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
                    sendWorkerReply({ cmd: "ping", ts: Date.now() });
                    return;
                }

                if (msg.cmd === "version") {
                    sendWorkerReply({
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

    const handleAutoShutdownStart = async (event = {}) => {
        beginShutdown();
        await runShutdownHook(event.trigger ?? "autoshutdown");
    };

    const handleFastifyClose = async () => {
        beginShutdown();
        let hookError = null;
        try {
            await runShutdownHook("fastify-close");
        } catch (ex) {
            hookError = ex;
        } finally {
            dispose();
        }

        if (hookError && !shutdownHookErrorHandled) {
            throw hookError;
        }
    };

    return {
        lifecycleContext,
        shutdownSignal: shutdownController.signal,
        gracefulShutdown,
        shutdownWithTimeout,
        handleAutoShutdownStart,
        handleFastifyClose,
        dispose,
    };
}
