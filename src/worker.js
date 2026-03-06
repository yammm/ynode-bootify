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

function resolveAppPlugin(appResult) {
    let appPlugin = appResult;

    if (appPlugin && typeof appPlugin === "object" && Object.hasOwn(appPlugin, "default")) {
        appPlugin = appPlugin.default;
    }

    if (typeof appPlugin !== "function") {
        throw new TypeError(
            "Invalid app plugin. Expected app(fastify, config) to return a Fastify plugin function or a module with a functional default export.",
        );
    }

    return appPlugin;
}

function parsePort(port) {
    const portNumber = Number(port);
    if (!Number.isInteger(portNumber) || portNumber < 0 || portNumber > 65535) {
        throw new Error(`Invalid listen port "${port}"`);
    }
    return portNumber;
}

function isSocketPath(value) {
    return (
        value.startsWith("/") ||
        value.startsWith("./") ||
        value.startsWith("../") ||
        value.startsWith(".\\") ||
        value.startsWith("..\\") ||
        value.startsWith("\\\\") ||
        /^[A-Za-z]:[\\/]/.test(value) ||
        value.includes("/") ||
        value.includes("\\")
    );
}

function parseListenObject(listen) {
    const hasPath = listen.path !== undefined && listen.path !== null;
    const hasPort = listen.port !== undefined && listen.port !== null;
    const hasHost = listen.host !== undefined && listen.host !== null;

    if (hasPath && (hasPort || hasHost)) {
        throw new Error(
            'Invalid listen config object: "path" cannot be combined with "host" or "port".',
        );
    }

    const listenConfig = {};

    if (hasPath) {
        if (typeof listen.path !== "string" || listen.path.trim().length === 0) {
            throw new Error("Invalid listen path. Expected a non-empty string.");
        }
        listenConfig.path = listen.path.trim();
    } else if (hasPort) {
        const host = hasHost ? String(listen.host).trim() : "127.0.0.1";
        if (host.length === 0) {
            throw new Error("Invalid listen host. Expected a non-empty string.");
        }
        listenConfig.host = host;
        listenConfig.port = parsePort(listen.port);
    } else {
        throw new Error(
            'Invalid listen config object. Expected either {"path": "..."} or {"port": number, "host"?: string}.',
        );
    }

    ["backlog", "readableAll", "writableAll", "ipv6Only", "exclusive"].forEach((key) => {
        if (listen[key] !== undefined) {
            listenConfig[key] = listen[key];
        }
    });

    return listenConfig;
}

export function parseListenConfig(listen) {
    if (listen && typeof listen === "object" && !Array.isArray(listen)) {
        return parseListenObject(listen);
    }

    const value = String(listen ?? 0).trim();

    if (value.length === 0) {
        return { port: 0, host: "127.0.0.1" };
    }

    if (isSocketPath(value)) {
        return { path: value };
    }

    if (/^\d+$/.test(value)) {
        return { port: parsePort(value), host: "127.0.0.1" };
    }

    const ipv6WithPort = /^\[([^\]]+)\]:(\d+)$/.exec(value);
    if (ipv6WithPort) {
        return { host: ipv6WithPort[1], port: parsePort(ipv6WithPort[2]) };
    }

    const hostPort = /^([^:]+):(\d+)$/.exec(value);
    if (hostPort) {
        return { host: hostPort[1], port: parsePort(hostPort[2]) };
    }

    if (value.includes(":")) {
        throw new Error(
            `Invalid listen address "${value}". Expected "host:port" or "[ipv6]:port" when using colons.`,
        );
    }

    throw new Error(
        `Invalid listen value "${value}". Expected "port", "host:port", "[ipv6]:port", or socket path.`,
    );
}

export function resolveListenRetry(config = {}) {
    const defaults = { retries: 5, delay: 15000 };
    const retry = config.listenRetry;

    if (retry === undefined || retry === null) {
        return defaults;
    }

    if (typeof retry !== "object" || Array.isArray(retry)) {
        throw new TypeError('Invalid "listenRetry" option. Expected an object.');
    }

    const retries = retry.retries ?? defaults.retries;
    const delay = retry.delay ?? defaults.delay;

    if (!Number.isInteger(retries) || retries < 1) {
        throw new TypeError('Invalid "listenRetry.retries" option. Expected an integer >= 1.');
    }

    if (!Number.isInteger(delay) || delay < 0) {
        throw new TypeError('Invalid "listenRetry.delay" option. Expected an integer >= 0.');
    }

    return { retries, delay };
}

/**
 * Tell Fastify to start listening with retry logic
 */
async function listen(fastify, retries = 5, delay = 100) {
    const config = fastify.config;
    const pkg = fastify.pkg;

    // Selective hearing
    const listenConfig = parseListenConfig(config.listen);

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

function resolveListenAddress(server) {
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
                if (typeof hooks.onShutdown === "function") {
                    await hooks.onShutdown({ ...lifecycleContext, signal });
                }
                await fastify.close();
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
            if (typeof msg === "object" && msg.cmd === "cluster-count") {
                fastify.clusterCount = msg.count;
            }

            if (msg === "shutdown") {
                try {
                    await gracefulShutdown("shutdown");
                } catch (ex) {
                    fastify.log.error(ex, "Error during shutdown command handling");
                }
            }
        };

        worker.on("message", workerMessageHandler);
    }

    const off = (target, event, handler) => {
        if (typeof target.off === "function") {
            target.off(event, handler);
            return;
        }
        if (typeof target.removeListener === "function") {
            target.removeListener(event, handler);
        }
    };

    const dispose = () => {
        signalHandlers.forEach((handler, signal) => off(signalTarget, signal, handler));
        if (worker && workerMessageHandler) {
            off(worker, "message", workerMessageHandler);
        }
    };

    return { lifecycleContext, gracefulShutdown, dispose };
}

/**
 * Start the worker process
 * @param {object} context
 * @param {object} context.app - The primary application plugin
 * @param {object} context.config - The configuration object
 * @param {object} context.log - Logger instance
 * @param {object} context.pkg - Package.json content
 * @param {object} [context.hooks] - Optional lifecycle hooks
 */
export async function start({ app, config, log, pkg, hooks = {} }) {
    // create the server instance by calling the factory function
    const fastify = await createServer(config, log);

    // decorate the fastify instance with config for access in routes
    fastify.decorate("config", config);

    // decorate the fastify instance with pkg for access in routes
    fastify.decorate("pkg", pkg);

    // add cluster count to fastify instance
    fastify.decorate("clusterCount", 1);

    // resolve app plugin
    const appPlugin = resolveAppPlugin(await app(fastify, config));

    // register the main application logic from app.js
    fastify.register(appPlugin);

    const lifecycleContext = { fastify, config, pkg };

    if (typeof hooks.onBeforeListen === "function") {
        await hooks.onBeforeListen(lifecycleContext);
    }

    const controller = createLifecycleController({ fastify, config, pkg, hooks });
    const { gracefulShutdown, dispose } = controller;

    fastify.addHook("onClose", async () => {
        dispose();
    });

    const retry = resolveListenRetry(config);
    await listen(fastify, retry.retries, retry.delay);

    if (typeof hooks.onAfterListen === "function") {
        try {
            await hooks.onAfterListen({
                ...lifecycleContext,
                address: resolveListenAddress(fastify.server),
            });
        } catch (ex) {
            await gracefulShutdown("onAfterListen-error");
            throw ex;
        }
    }
}
