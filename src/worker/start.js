/**
 * @fileoverview worker/start.js: Worker startup orchestration.
 */

import { createServer } from "../server.js";
import { createLifecycleController, resolveListenAddress } from "./lifecycle.js";
import { listen, resolveListenRetry } from "./listen.js";

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

/**
 * Start the worker process
 * @param {object} context
 * @param {object} context.app - The primary application plugin
 * @param {object} context.config - The configuration object
 * @param {object} context.log - Logger instance
 * @param {object} context.pkg - Package.json content
 * @param {object} [context.hooks] - Optional lifecycle hooks
 * @param {object} [context._internal] - Internal test hooks
 */
export async function start({ app, config, log, pkg, hooks = {}, _internal = {} }) {
    const createServerFn = _internal.createServer ?? createServer;
    const listenFn = _internal.listen ?? listen;
    const lifecycleControllerFactory = _internal.createLifecycleController ?? createLifecycleController;

    // create the server instance by calling the factory function
    const fastify = await createServerFn(config, log);

    // decorate the fastify instance with config for access in routes
    fastify.decorate("config", config);

    // decorate the fastify instance with pkg for access in routes
    fastify.decorate("pkg", pkg);

    // add cluster count to fastify instance
    fastify.decorate("clusterCount", 1);

    const lifecycleContext = { fastify, config, pkg };
    let gracefulShutdown = null;
    let dispose = () => {};
    let startupShutdownSignal = "startup-error";

    try {
        const controller = lifecycleControllerFactory({ fastify, config, pkg, hooks });
        gracefulShutdown = controller.gracefulShutdown;
        dispose = controller.dispose;

        fastify.addHook("onClose", async () => {
            dispose();
        });

        // resolve app plugin
        const appPlugin = resolveAppPlugin(await app(fastify, config));

        // register the main application logic from app.js
        fastify.register(appPlugin);

        if (typeof hooks.onBeforeListen === "function") {
            await hooks.onBeforeListen(lifecycleContext);
        }

        const retry = resolveListenRetry(config);
        await listenFn(fastify, retry.retries, retry.delay);

        if (typeof hooks.onAfterListen === "function") {
            try {
                await hooks.onAfterListen({
                    ...lifecycleContext,
                    address: resolveListenAddress(fastify.server),
                });
            } catch (ex) {
                startupShutdownSignal = "onAfterListen-error";
                throw ex;
            }
        }
    } catch (ex) {
        try {
            if (gracefulShutdown) {
                await gracefulShutdown(startupShutdownSignal);
            } else {
                await fastify.close();
            }
        } catch (shutdownEx) {
            fastify.log.error(shutdownEx, "Error during startup cleanup.");
        } finally {
            dispose();
        }
        throw ex;
    }
}
