/**
 * @fileoverview worker/start.js: Worker startup orchestration.
 */

/*
The MIT License (MIT)

Copyright (c) 2026 Michael Welter <me@mikinho.com>

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

import { createServer } from "../server.js";
import { createLifecycleController, resolveListenAddress } from "./lifecycle.js";
import { listen, resolveListenRetry } from "./listen.js";

/**
 * Extracts a Fastify plugin function from the app module result.
 * Accepts either a bare function or a module with a `default` export.
 * @param {function|object} appResult - Return value of the app() function.
 * @returns {function(object, object): Promise<void>} Fastify plugin function.
 */
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
 * @returns {Promise<void>}
 */
export async function start({ app, config, log, pkg, hooks = {}, _internal = {} }) {
    const createServerFn = _internal.createServer ?? createServer;
    const listenFn = _internal.listen ?? listen;
    const lifecycleControllerFactory =
        _internal.createLifecycleController ?? createLifecycleController;

    // create the server instance by calling the factory function
    const fastify = await createServerFn(config, log);

    // decorate the fastify instance with config for access in routes
    fastify.decorate("config", config);

    // decorate the fastify instance with pkg for access in routes
    fastify.decorate("pkg", pkg);

    // add cluster count to fastify instance
    fastify.decorate("clusterCount", 1);
    fastify.decorate("clusterMinWorkers", 1);
    fastify.decorate("clusterMaxWorkers", 1);
    fastify.decorate("clusterMode", "smart");

    let lifecycleContext = { fastify, config, pkg };
    let gracefulShutdown = null;
    let shutdownWithTimeout = null;
    let shutdownSignal;
    let handleFastifyClose = null;
    let dispose = () => {};
    let startupShutdownSignal = "startup-error";

    try {
        const controller = lifecycleControllerFactory({ fastify, config, pkg, hooks });
        lifecycleContext = controller.lifecycleContext ?? lifecycleContext;
        gracefulShutdown = controller.gracefulShutdown;
        shutdownWithTimeout = controller.shutdownWithTimeout;
        shutdownSignal = controller.shutdownSignal;
        handleFastifyClose = controller.handleFastifyClose;
        dispose = controller.dispose;

        if (controller.lifecycle) {
            fastify.decorate("bootify", controller.lifecycle);
        }

        fastify.addHook("onClose", async () => {
            if (handleFastifyClose) {
                await handleFastifyClose();
            } else {
                dispose();
            }
        });

        const registerAutoShutdownHooks = () => {
            if (
                typeof fastify.onAutoShutdownStart === "function" &&
                typeof controller.handleAutoShutdownStart === "function"
            ) {
                fastify.onAutoShutdownStart(controller.handleAutoShutdownStart);
            }
            if (
                typeof fastify.onAutoShutdownCommit === "function" &&
                typeof controller.handleAutoShutdownCommit === "function"
            ) {
                fastify.onAutoShutdownCommit(controller.handleAutoShutdownCommit);
            }
            if (
                typeof fastify.onAutoShutdownComplete === "function" &&
                typeof controller.handleAutoShutdownComplete === "function"
            ) {
                fastify.onAutoShutdownComplete(controller.handleAutoShutdownComplete);
            }
        };
        if (typeof fastify.onAutoShutdownStart === "function") {
            registerAutoShutdownHooks();
        } else if (typeof fastify.after === "function") {
            fastify.after((err) => {
                if (err) {
                    throw err;
                }
                registerAutoShutdownHooks();
            });
        }

        // resolve app plugin
        const appPlugin = resolveAppPlugin(await app(fastify, config));

        // register the main application logic from app.js
        fastify.register(appPlugin);

        if (typeof hooks.onBeforeListen === "function") {
            await hooks.onBeforeListen(lifecycleContext);
        }

        const { retries, delay } = resolveListenRetry(config);
        await listenFn(fastify, { retries, delay, signal: shutdownSignal });

        const address = resolveListenAddress(fastify.server);
        controller.markListening?.(address);

        if (typeof hooks.onAfterListen === "function") {
            try {
                await hooks.onAfterListen({
                    ...lifecycleContext,
                    address,
                });
            } catch (ex) {
                startupShutdownSignal = "onAfterListen-error";
                throw ex;
            }
        }
    } catch (ex) {
        const interruptedByShutdown =
            shutdownSignal?.aborted === true &&
            (ex === shutdownSignal.reason || ex?.name === "AbortError");
        try {
            if (shutdownWithTimeout) {
                await shutdownWithTimeout(startupShutdownSignal);
            } else if (gracefulShutdown) {
                await gracefulShutdown(startupShutdownSignal);
            } else {
                await fastify.close();
            }
        } catch (shutdownEx) {
            fastify.log.error(shutdownEx, "Error during startup cleanup.");
        } finally {
            dispose();
        }
        if (interruptedByShutdown) {
            return;
        }
        throw ex;
    }
}
