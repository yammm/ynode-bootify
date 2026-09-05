import assert from "node:assert/strict";
import test from "node:test";

import { chunkFileArguments, parseNulList } from "../scripts/check-staged.mjs";

test("staged paths retain spaces, newlines, and option-looking prefixes", () => {
    const paths = ["plain.js", "space name.js", "line\nbreak.js", "-option.js"];
    assert.deepEqual(parseNulList(`${paths.join("\0")}\0`), paths);
});

test("staged paths are grouped without changing individual arguments", () => {
    const paths = ["one.js", "two two.js", "three.js"];
    const chunks = chunkFileArguments(paths, 14);
    assert.deepEqual(chunks.flat(), paths);
    assert.ok(chunks.every((chunk) => chunk.length > 0));
});
