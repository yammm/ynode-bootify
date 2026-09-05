#!/usr/bin/env node

/**
 * Verifies that a release tag, package manifest, and changelog identify the
 * same clean SemVer before a package is published.
 */

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const CLEAN_SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;
const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));

/**
 * Validate release identity.
 *
 * @param {{name?: unknown, version?: unknown, publishConfig?: {access?: unknown}}} manifest
 * Package manifest.
 * @param {string} tag Git tag name.
 */
export function verifyReleaseIdentity(manifest, tag) {
    if (typeof manifest.name !== "string" || !manifest.name.startsWith("@ynode/")) {
        throw new TypeError("package.json must contain an @ynode package name");
    }
    if (typeof manifest.version !== "string" || !CLEAN_SEMVER_PATTERN.test(manifest.version)) {
        throw new TypeError("package.json version must be a clean X.Y.Z SemVer");
    }
    if (tag !== `v${manifest.version}`) {
        throw new TypeError(
            `release tag ${tag} does not match package version ${manifest.version}`,
        );
    }
    if (manifest.publishConfig?.access !== "public") {
        throw new TypeError("package.json publishConfig.access must be public");
    }
}

/**
 * Verify that the first generated changelog release is the tagged version.
 *
 * @param {string} changelog Changelog source.
 * @param {string} tag Git tag name.
 */
export function verifyChangelog(changelog, tag) {
    const firstRelease = changelog.match(/^#### \[([^\]]+)\]/mu)?.[1];
    if (firstRelease !== tag) {
        throw new TypeError(
            `first changelog release ${firstRelease ?? "(missing)"} does not match ${tag}`,
        );
    }
}

async function main() {
    const [tag, ...extraArguments] = process.argv.slice(2);
    if (!tag || extraArguments.length > 0) {
        throw new TypeError("Usage: node scripts/verify-release.mjs <vX.Y.Z>");
    }

    const manifest = JSON.parse(
        await fs.readFile(path.join(repositoryRoot, "package.json"), "utf8"),
    );
    const changelog = await fs.readFile(path.join(repositoryRoot, "CHANGELOG.md"), "utf8");
    verifyReleaseIdentity(manifest, tag);
    verifyChangelog(changelog, tag);
    process.stdout.write(`Release identity verified for ${manifest.name} ${manifest.version}.\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().catch((error) => {
        process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
        process.exitCode = 1;
    });
}
