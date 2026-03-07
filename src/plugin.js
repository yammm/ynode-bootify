/**
 * @fileoverview A Fastify application bootstrapper and lifecycle manager with lots of @ynode helpers.
 *
 * This file is the entry point. It loads the configuration and initializes the
 * cluster manager. The actual application logic runs in the worker process.
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

import { join } from "node:path";
import { pathToFileURL } from "node:url";

// server factory function
import { run } from "@ynode/cluster";
// configs
// import pkg from "${process.cwd()}/package.json" with { type: "json" };
// logging
import ylog from "@ynode/ylog";

import { off } from "./events.js";
import { start } from "./worker.js";

const BOOTIFY_ONCE_ERROR = "bootify() can only be called once per process.";
const BOOTIFY_STARTING_ERROR = "bootify() is already starting in this process.";
let bootifyState = "idle";

function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertFunction(value, name) {
    if (typeof value !== "function") {
        throw new TypeError(`Invalid "${name}" option. Expected a function.`);
    }
}

function assertObject(value, name) {
    if (!isObject(value)) {
        throw new TypeError(`Invalid "${name}" option. Expected an object.`);
    }
}

function validateHooks(hooks) {
    assertObject(hooks, "hooks");

    ["onBeforeListen", "onAfterListen", "onShutdown"].forEach((name) => {
        if (hooks[name] !== undefined && typeof hooks[name] !== "function") {
            throw new TypeError(`Invalid "hooks.${name}" option. Expected a function.`);
        }
    });
}

/**
 * Main entry point
 * @param {object} options
 * @param {function} options.app - Function returning Promise<{default: plugin}>.
 * @param {object} options.config - The configuration object (argv).
 * @param {object} [options.pkg] - Optional package.json object, default is to load from `${process.cwd()}/package.json`.
 * @param {function} [options.validator] - Optional function to validate `config` before starting.
 * @param {object} [options.hooks] - Optional lifecycle hooks.
 * @param {object} [options._internal] - Internal test hooks.
 */
export async function bootify({ app, config, pkg, validator, hooks, _internal = {} }) {
    const processTarget = _internal.process ?? process;
    const runFn = _internal.run ?? run;
    const ylogFn = _internal.ylog ?? ylog;
    const getBootifyStateFn = _internal.getBootifyState ?? (() => bootifyState);
    const setBootifyStateFn =
        _internal.setBootifyState ??
        ((nextState) => {
            bootifyState = nextState;
        });
    const loadMkpidfileFn =
        _internal.loadMkpidfile ??
        (async () => {
            const module = await import("mkpidfile");
            return module.default;
        });

    assertFunction(app, "app");
    assertObject(config, "config");

    if (pkg !== undefined) {
        assertObject(pkg, "pkg");
    }

    if (validator !== undefined) {
        assertFunction(validator, "validator");
    }

    if (hooks !== undefined) {
        validateHooks(hooks);
    }

    const currentState = getBootifyStateFn();
    if (currentState === "starting") {
        throw new Error(BOOTIFY_STARTING_ERROR);
    }
    if (currentState === "started") {
        throw new Error(BOOTIFY_ONCE_ERROR);
    }
    setBootifyStateFn("starting");

    const sigquitHandler = () => {
        if (typeof processTarget.abort === "function") {
            processTarget.abort();
            return;
        }
        process.abort();
    };
    let exitHandler = null;
    let sighupHandler = null;

    try {
        if (validator) {
            await validator(config);
        }

        if (!pkg) {
            const pkgUrl = pathToFileURL(join(process.cwd(), "package.json")).href;
            pkg = (await import(pkgUrl, { with: { type: "json" } })).default;
        }

        // logging
        const log = ylogFn(import.meta, { pid: true });

        // terminate with core dump
        processTarget.on("SIGQUIT", sigquitHandler);

        // bye bye
        exitHandler = (code) => {
            log.info(`Sayonara. Exit code: ${code}`);
        };
        processTarget.on("exit", exitHandler);

        // mkpidfile  module
        if (config.pidfile) {
            const mkpidfile = _internal.mkpidfile ?? (await loadMkpidfileFn());
            mkpidfile(config.pidfile);
        }

        // main
        const manager = await runFn(
            async () => start({ app, config, log, pkg, hooks }),
            {
                ...(typeof config.cluster === "object" ? config.cluster : { enabled: config.cluster }),
            },
            log,
        );

        // trigger zero-downtime reload
        if (manager && typeof manager.reload === "function") {
            sighupHandler = () => {
                Promise.resolve(manager.reload()).catch((ex) => {
                    log.error(ex, "SIGHUP-triggered reload failed.");
                });
            };
            processTarget.on("SIGHUP", sighupHandler);
        }

        setBootifyStateFn("started");
        return manager;
    } catch (ex) {
        setBootifyStateFn("idle");
        off(processTarget, "SIGQUIT", sigquitHandler);
        if (exitHandler) {
            off(processTarget, "exit", exitHandler);
        }
        if (sighupHandler) {
            off(processTarget, "SIGHUP", sighupHandler);
        }
        throw ex;
    }
}
