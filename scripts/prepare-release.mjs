#!/usr/bin/env node

/**
 * Prepares a clean, signed SemVer release commit and tag without pushing or
 * publishing. Public state changes only after the maintainer reviews and pushes
 * the resulting commit and tag.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { verifyChangelog, verifyReleaseIdentity } from "./verify-release.mjs";

const RELEASE_LEVELS = new Set(["patch", "minor", "major"]);
const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const releaseFiles = ["package.json", "package-lock.json", "CHANGELOG.md"];
const startingHead = runForOutput("git", ["rev-parse", "HEAD"]);
const snapshots = new Map(
    releaseFiles.map((file) => [file, fs.readFileSync(path.join(repositoryRoot, file))]),
);

function execute(command, arguments_, options = {}) {
    const result = spawnSync(command, arguments_, {
        cwd: repositoryRoot,
        encoding: "utf8",
        env: options.env ?? process.env,
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

function runForOutput(command, arguments_) {
    return execute(command, arguments_, { capture: true }).trim();
}

function assertReleaseCheckout() {
    if (runForOutput("git", ["status", "--porcelain", "--untracked-files=all"])) {
        throw new Error("release preparation requires a clean working tree");
    }
    if (runForOutput("git", ["branch", "--show-current"]) !== "main") {
        throw new Error("release preparation must run from the main branch");
    }
    const upstream = runForOutput("git", ["rev-parse", "@{upstream}"]);
    if (upstream !== startingHead) {
        throw new Error("main must be synchronized with its upstream before release");
    }
}

function changedPaths() {
    const tracked = parseNulOutput(
        execute("git", ["diff", "--name-only", "-z"], { capture: true }),
    );
    const untracked = parseNulOutput(
        execute("git", ["ls-files", "--others", "--exclude-standard", "-z"], {
            capture: true,
        }),
    );
    return [...new Set([...tracked, ...untracked])];
}

function parseNulOutput(output) {
    return output.split("\0").filter(Boolean);
}

function restoreLocalChanges() {
    for (const [file, contents] of snapshots) {
        fs.writeFileSync(path.join(repositoryRoot, file), contents);
    }
    execute("git", ["restore", "--staged", "--", ...releaseFiles]);
}

function main() {
    const [level, ...extraArguments] = process.argv.slice(2);
    if (!RELEASE_LEVELS.has(level) || extraArguments.length > 0) {
        throw new TypeError("Usage: node scripts/prepare-release.mjs <patch|minor|major>");
    }

    assertReleaseCheckout();
    const releaseEnvironment = { ...process.env, AUTOVER_SKIP: "1" };
    let commitCreated = false;

    try {
        execute(npmCommand, ["version", level, "--no-git-tag-version", "--ignore-scripts"], {
            env: releaseEnvironment,
        });
        execute(npmCommand, ["run", "changelog"], { env: releaseEnvironment });
        execute(npmCommand, ["run", "prepublishOnly"], { env: releaseEnvironment });

        const manifest = JSON.parse(
            fs.readFileSync(path.join(repositoryRoot, "package.json"), "utf8"),
        );
        const tag = `v${manifest.version}`;
        const changelog = fs.readFileSync(path.join(repositoryRoot, "CHANGELOG.md"), "utf8");
        verifyReleaseIdentity(manifest, tag);
        verifyChangelog(changelog, tag);

        const unexpectedPaths = changedPaths().filter((file) => !releaseFiles.includes(file));
        if (unexpectedPaths.length > 0) {
            throw new Error(
                `release checks changed unexpected paths: ${unexpectedPaths.join(", ")}`,
            );
        }

        execute("git", ["add", "--", ...releaseFiles]);
        execute("git", ["commit", "-S", "-s", "-m", `chore(release): ${tag}`], {
            env: releaseEnvironment,
        });
        commitCreated = true;
        execute("git", ["tag", "-s", tag, "-m", `Release ${tag}`]);
        process.stdout.write(
            `Prepared signed release ${tag}. Review it, then run git push --follow-tags.\n`,
        );
    } catch (error) {
        const currentHead = runForOutput("git", ["rev-parse", "HEAD"]);
        if (!commitCreated && currentHead === startingHead) {
            restoreLocalChanges();
        } else {
            process.stderr.write(
                "The release commit exists locally; inspect it and create the signed tag before pushing.\n",
            );
        }
        throw error;
    }
}

try {
    main();
} catch (error) {
    process.stderr.write(
        `Release preparation failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = Number.isInteger(error?.status) ? error.status : 1;
}
