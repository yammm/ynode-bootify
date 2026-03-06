/**
 *  worker.js: The Application Worker
 *
 * @module worker
 *
 * This module is responsible for the runtime lifecycle of the application.
 * It creates the Fastify server, handles signal listeners, and starts listening.
 */

import cluster from "node:cluster";
import { createServer } from "./server.js";

/**
 * Helper to retry an async operation
 */
async function retryOperation(operation, { retries = 5, delay = 100, onRetry } = {}) {
    for (let attempt = 1; attempt <= retries; ++attempt) {
        try {
            return await operation();
        } catch (ex) {
            if (attempt >= retries) {
                throw ex;
            }
            if (onRetry) {
                onRetry(ex, attempt, delay);
            }
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }
}

/**
 * Tell Fastify to start listening with retry logic
 */
async function listen(fastify, retries = 5, delay = 100) {
    const config = fastify.config;
    const pkg = fastify.pkg;

    // Selective hearing
    const [port, host = "127.0.0.1"] = String(config.listen ?? 0)
        .split(":")
        .reverse();
    const listenConfig = !isNaN(port) ? { port: Number(port), host } : { path: port };

    listenConfig.listenTextResolver = (address) =>
        `Moshi moshi ${pkg.name} v${pkg.version} in ${config.environment} mode listening on ${address}`;

    try {
        await retryOperation(() => fastify.listen(listenConfig), {
            retries,
            delay,
            onRetry: (ex, attempt, nextDelay) => {
                fastify.log.warn(
                    `Attempt ${attempt} failed: ${ex.message}. Retrying in ${nextDelay}ms...`,
                    ex,
                );
            },
        });
    } catch (ex) {
        fastify.log.error("All attempts failed. No cake today.");
        throw ex;
    }
}

/**
 * Start the worker process
 * @param {object} context
 * @param {object} context.app - The primary application plugin
 * @param {object} context.config - The configuration object
 * @param {object} context.log - Logger instance
 * @param {object} context.pkg - Package.json content
 */
export async function start({ app, config, log, pkg }) {
    // create the server instance by calling the factory function
    const fastify = await createServer(config, log);

    // decorate the fastify instance with config for access in routes
    fastify.decorate("config", config);

    // decorate the fastify instance with pkg for access in routes
    fastify.decorate("pkg", pkg);

    // add cluster count to fastify instance
    fastify.decorate("clusterCount", 1);

    // resolve app plugin
    let appPlugin = await app(fastify, config);
    if (appPlugin && typeof appPlugin === "object" && appPlugin.default) {
        appPlugin = appPlugin.default;
    }

    // register the main application logic from app.js
    fastify.register(appPlugin);

    // setup signal handlers so process exit event can be triggered
    ["SIGINT", "SIGTERM", "SIGUSR2"].forEach((signal) =>
        process.on(signal, async (s) => {
            await fastify.close();
        }),
    );

    // graceful exit if our master requests it
    if (cluster.worker) {
        cluster.worker.on("message", async (msg) => {
            if (typeof msg === "object" && msg.cmd === "cluster-count") {
                fastify.clusterCount = msg.count;
            }
            switch (msg) {
                case "shutdown": {
                    await fastify.close();
                    break;
                }
            }
        });

        // Uncomment to force exit but shouldn't be needed
        // cluster.worker.on("disconnect", () => process.nextTick(process.exit));
    }

    await listen(fastify, 5, 15000);
}
