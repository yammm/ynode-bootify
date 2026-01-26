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
 * Generates a `yuidoc.json` configuration file dynamically from `package.json`
 * and runs YUIDoc to produce project documentation in the `docs/` directory.
 *
 * @module gen-docs
 * @main gen-docs
 * @version 1.0.0
 * @since 1.0.0
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

/**
 * Resolve the path to `package.json` and import its contents.
 *
 * @property {string} pkgPath Absolute path to the local package.json file.
 * @property {Object} pkg Parsed package.json contents.
 */
const pkgPath = resolve(process.cwd(), "package.json");
const pkg = (await import(pkgPath, { with: { type: "json" } })).default;

/**
 * Extracts metadata from the project's package.json for documentation generation.
 *
 * @property {string} name        Project name, defaults to "TODO: name".
 * @property {string} description Project description, defaults to "TODO: description".
 * @property {string} version     Project version string.
 * @property {string} url         Project homepage or empty string.
 */
const name = pkg.name ?? "TODO: name";
const description = pkg.description ?? "TODO: description";
const version = pkg.version ?? "0.0.0";
const url = (pkg.homepage ?? "").toString();

/**
 * Ensures that the output directory for YUIDoc exists.
 *
 * @property {string} outdir Path to the documentation output directory.
 */
const outdir = "docs";
if (!existsSync(outdir)) {
    mkdirSync(outdir, { recursive: true });
}

/**
 * Build the YUIDoc configuration object from package.json metadata.
 *
 * @property {Object} yui
 * @property {Object} yui.options Paths, output, and generation options for YUIDoc.
 */
const yui = {
    name: name,
    description: description,
    version: version,
    url: url,
    options: {
        paths: ["src"],
        outdir: "docs",
        exclude: ["node_modules", ".git"].join(","),
        extensions: [".js"].join(","),
        syntaxtype: "js",
        quiet: true,
    },
};

/**
 * Write the configuration to `yuidoc.json` at the project root.
 *
 * @property {string} yuiPath Full path to the generated YUIDoc configuration file.
 */
const yuiPath = resolve(process.cwd(), "yuidoc.json");
writeFileSync(yuiPath, JSON.stringify(yui, null, 4) + "\n", "utf8");

/**
 * Executes YUIDoc with the generated configuration.
 *
 * @method execFileSync
 * @param {string} "npx" - CLI command.
 * @param {Array<string>} ["-y", "yuidoc"] - Command arguments to invoke YUIDoc.
 * @param {Object} options - Subprocess options (inherit stdio for live output).
 * @return {void}
 */
execFileSync("npx", ["-y", "yuidoc"], { stdio: "inherit" });
