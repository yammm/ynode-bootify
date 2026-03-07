/**
 * @fileoverview worker/lifecycle.js: Worker signal/message lifecycle wiring.
 */

import cluster from "node:cluster";

import { off } from "../events.js";

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

export function createLifecycleController({
    fastify,
    config,
    pkg,
    hooks = {},
    signalTarget = process,
    worker = cluster.worker,
}) {
    const lifecycleContext = { fastify, config, pkg };

    let shutdownPromise = null;
    const gracefulShutdown = async (signal) => {
        if (!shutdownPromise) {
            shutdownPromise = (async () => {
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

    const signalHandlers = new Map();
    ["SIGINT", "SIGTERM", "SIGUSR2"].forEach((signal) => {
        const handler = async () => {
            try {
                await gracefulShutdown(signal);
            } catch (ex) {
                fastify.log.error(ex, `Error during shutdown after ${signal}`);
            }
        };
        signalHandlers.set(signal, handler);
        signalTarget.on(signal, handler);
    });

    let workerMessageHandler = null;
    if (worker) {
        workerMessageHandler = async (msg) => {
            if (msg && typeof msg === "object" && msg.cmd === "cluster-count") {
                if (Number.isInteger(msg.count) && msg.count > 0) {
                    fastify.clusterCount = msg.count;
                } else {
                    fastify.log.warn(
                        { count: msg.count },
                        "Ignoring invalid cluster-count message payload.",
                    );
                }
            }

            if (msg === "shutdown") {
                try {
                    await gracefulShutdown("shutdown");
                    worker.disconnect();
                } catch (ex) {
                    fastify.log.error(ex, "Error during shutdown command handling");
                    process.exit(1);
                }
            }
        };

        worker.on("message", workerMessageHandler);
    }

    const dispose = () => {
        signalHandlers.forEach((handler, signal) => off(signalTarget, signal, handler));
        if (worker && workerMessageHandler) {
            off(worker, "message", workerMessageHandler);
        }
    };

    return { lifecycleContext, gracefulShutdown, dispose };
}
