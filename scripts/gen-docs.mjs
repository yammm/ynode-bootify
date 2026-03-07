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
 * Generates a JSDoc configuration file dynamically from `package.json`
 * and runs JSDoc to produce project documentation in the `docs/` directory.
 *
 * @module gen-docs
 * @main gen-docs
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
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
 */
const name = pkg.name ?? "TODO: name";
const description = pkg.description ?? "TODO: description";
const version = pkg.version ?? "0.0.0";
const url = (pkg.homepage ?? "").toString();

const outdir = "docs";
if (!existsSync(outdir)) {
    mkdirSync(outdir, { recursive: true });
}

const jsdocConfigPath = resolve(process.cwd(), ".jsdoc.generated.json");
const jsdoc = {
    source: {
        include: ["src"],
        exclude: ["node_modules", ".git"],
        includePattern: ".+\\.js$",
        excludePattern: "(^|\\/|\\\\)(node_modules|docs|\\.git)(\\/|\\\\|$)",
    },
    opts: {
        destination: outdir,
        recurse: true,
        readme: "README.md",
        encoding: "utf8",
        lenient: true,
    },
    plugins: ["plugins/markdown"],
    templates: {
        default: {
            includeDate: false,
        },
    },
    metadata: {
        name,
        description,
        version,
        url,
    },
};

writeFileSync(jsdocConfigPath, JSON.stringify(jsdoc, null, 4) + "\n", "utf8");

try {
    const jsdocBin = resolve(process.cwd(), "node_modules", "jsdoc", "jsdoc.js");
    if (!existsSync(jsdocBin)) {
        throw new Error(
            "JSDoc binary not found at node_modules/jsdoc/jsdoc.js. Run `npm install` to install dev dependencies.",
        );
    }

    execFileSync(process.execPath, [jsdocBin, "-c", jsdocConfigPath], {
        stdio: "inherit",
    });
} finally {
    // Ensure cleanup of the temporary tracking configuration file
    rmSync(jsdocConfigPath, { force: true });
}
