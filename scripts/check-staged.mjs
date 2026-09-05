#!/usr/bin/env node

/**
 * Runs staged-file formatting and lint checks without reparsing filenames
 * through a command shell.
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const MAX_ARGUMENT_CHARACTERS = 6_000;
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";

/**
 * Parse a NUL-delimited Git path list.
 *
 * @param {string} output Git command output.
 * @returns {string[]} Paths in their original form.
 */
export function parseNulList(output) {
    return output.split("\0").filter(Boolean);
}

/**
 * Split filenames into bounded argument groups for Windows and Unix launchers.
 *
 * @param {readonly string[]} files Paths to group.
 * @param {number} [limit] Approximate command-line character ceiling.
 * @returns {string[][]} Non-empty argument groups.
 */
export function chunkFileArguments(files, limit = MAX_ARGUMENT_CHARACTERS) {
    const chunks = [];
    let current = [];
    let length = 0;

    for (const file of files) {
        const additionalLength = file.length + 1;
        if (current.length > 0 && length + additionalLength > limit) {
            chunks.push(current);
            current = [];
            length = 0;
        }
        current.push(file);
        length += additionalLength;
    }

    if (current.length > 0) {
        chunks.push(current);
    }
    return chunks;
}

function run(command, arguments_, options = {}) {
    const result = spawnSync(command, arguments_, {
        encoding: "utf8",
        stdio: options.capture ? "pipe" : "inherit",
    });
    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        const error = new Error(`${command} exited with status ${result.status ?? 1}`);
        error.status = result.status ?? 1;
        throw error;
    }
    return result.stdout ?? "";
}

function runForFiles(label, executable, arguments_, files) {
    process.stdout.write(`[pre-commit] Running ${label}...\n`);
    for (const chunk of chunkFileArguments(files)) {
        run(npxCommand, ["--no-install", executable, ...arguments_, "--", ...chunk]);
    }
}

/**
 * Execute the staged-file checks.
 *
 * @param {{lintOnly?: boolean}} [options] Whether to omit formatting and tests.
 */
export function checkStaged({ lintOnly = false } = {}) {
    const output = run("git", ["diff", "--cached", "--name-only", "--diff-filter=ACMRTUXB", "-z"], {
        capture: true,
    });
    const files = parseNulList(output);

    if (files.length > 0) {
        if (!lintOnly) {
            runForFiles("Prettier", "prettier", ["--check", "--ignore-unknown"], files);
        }
        runForFiles("ESLint", "eslint", ["--no-warn-ignored"], files);
    }

    if (!lintOnly) {
        process.stdout.write("[pre-commit] Running Test Suite...\n");
        run(npmCommand, ["test"]);
        process.stdout.write("[pre-commit] All checks passed!\n");
    }
}

function isDirectInvocation() {
    if (!process.argv[1]) {
        return false;
    }
    return import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

if (isDirectInvocation()) {
    const arguments_ = process.argv.slice(2);
    if (arguments_.some((argument) => argument !== "--lint-only")) {
        process.stderr.write("Usage: node scripts/check-staged.mjs [--lint-only]\n");
        process.exitCode = 2;
    } else {
        try {
            checkStaged({ lintOnly: arguments_.includes("--lint-only") });
        } catch (error) {
            process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
            process.exitCode = Number.isInteger(error?.status) ? error.status : 1;
        }
    }
}
