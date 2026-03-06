#!/usr/bin/env node

/*
The MIT License (MIT)

Copyright (c) 2025 Michael Welter <me@mikinho.com>

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

/**
 * Generates a `jsdoc.json` configuration file and runs JSDoc
 * to produce project documentation in the `docs/` directory.
 *
 * @module gen-docs
 * @main gen-docs
 * @version 1.0.0
 * @since 1.0.0
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

/**
 * Resolve key project paths.
 *
 * @property {string} pkgPath Absolute path to the local package.json file.
 * @property {string} readmePath Absolute path to the local README.md file.
 */
const pkgPath = resolve(process.cwd(), "package.json");
const readmePath = resolve(process.cwd(), "README.md");

/**
 * Ensures that the output directory for JSDoc exists.
 *
 * @property {string} outdir Path to the documentation output directory.
 */
const outdir = "docs";
if (existsSync(outdir)) {
    rmSync(outdir, { recursive: true, force: true });
}
if (!existsSync(outdir)) {
    mkdirSync(outdir, { recursive: true });
}

/**
 * Build a JSDoc configuration object.
 *
 * @property {Object} jsdocConfig
 * @property {Object} jsdocConfig.source Source include and exclude patterns.
 * @property {Object} jsdocConfig.opts Output and recursion options.
 */
const jsdocConfig = {
    source: {
        include: ["src"],
        includePattern: ".+\\.js$",
        excludePattern: "(^|\\/|\\\\)_",
    },
    opts: {
        destination: outdir,
        recurse: true,
        encoding: "utf8",
    },
    templates: {
        default: {
            includeDate: false,
        },
    },
};

/**
 * Write the configuration to `jsdoc.json` at the project root.
 *
 * @property {string} configPath Full path to the generated JSDoc configuration file.
 */
const configPath = resolve(process.cwd(), "jsdoc.json");
writeFileSync(configPath, JSON.stringify(jsdocConfig, null, 4) + "\n", "utf8");

/**
 * Executes JSDoc with the generated configuration.
 *
 * @method execFileSync
 * @param {string} "npx" - CLI command to run local JSDoc.
 * @param {Array<string>} ["jsdoc", "-c", configPath, "-P", pkgPath, "-R", readmePath] - Command arguments to invoke JSDoc.
 * @param {Object} options - Subprocess options (inherit stdio for live output).
 * @return {void}
 */
execFileSync("npx", ["jsdoc", "-c", configPath, "-P", pkgPath, "-R", readmePath], {
    stdio: "inherit",
});
