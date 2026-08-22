import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));

test("package metadata preserves public manifest and changelog access", () => {
    assert.strictEqual(manifest.exports["./package.json"], "./package.json");
    assert.ok(manifest.files.includes("CHANGELOG.md"));
});

test("npm pack includes the public manifest and changelog", () => {
    const cache = mkdtempSync(join(tmpdir(), "ynode-bootify-pack-"));
    try {
        const npm = process.platform === "win32" ? "npm.cmd" : "npm";
        const result = spawnSync(npm, ["pack", "--dry-run", "--ignore-scripts", "--json"], {
            cwd: packageRoot,
            encoding: "utf8",
            env: { ...process.env, npm_config_cache: cache },
        });
        assert.strictEqual(result.status, 0, result.stderr || result.stdout);
        const files = new Set(JSON.parse(result.stdout)[0].files.map(({ path }) => path));
        assert.ok(files.has("package.json"));
        assert.ok(files.has("CHANGELOG.md"));
    } finally {
        rmSync(cache, { recursive: true, force: true });
    }
});
