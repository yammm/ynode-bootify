/**
 * A Fastify application bootstrapper and lifecycle manager with lots of @ynode helpers
 *
 * @module @ynode/bootify
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

import { pathToFileURL } from "node:url";
import { join } from "node:path";

// server factory function
import { run } from "@ynode/cluster";
import { start } from "./worker.js";

// configs
// import pkg from "${process.cwd()}/package.json" with { type: "json" };

// logging
import ylog from "@ynode/ylog";

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
 */
export async function bootify({ app, config, pkg, validator, hooks }) {
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

    if (validator) {
        await validator(config);
    }

    if (!pkg) {
        const pkgUrl = pathToFileURL(join(process.cwd(), "package.json")).href;
        pkg = (await import(pkgUrl, { with: { type: "json" } })).default;
    }

    // logging
    const log = ylog(import.meta, { pid: true });

    // terminate with core dump
    process.on("SIGQUIT", process.abort);

    // bye bye
    process.on("exit", (code) => {
        log.info(`Sayonara. Exit code: ${code}`);
    });

    // mkpidfile  module
    if (config.pidfile) {
        const { default: mkpidfile } = await import("mkpidfile");
        mkpidfile(config.pidfile);
    }

    // main
    const manager = await run(
        async () => start({ app, config, log, pkg, hooks }),
        { ...(typeof config.cluster === "object" ? config.cluster : { enabled: config.cluster }) },
        log,
    );

    // trigger zero-downtime reload
    if (manager && manager.reload) {
        process.on("SIGHUP", manager.reload);
    }

    return manager;
}
