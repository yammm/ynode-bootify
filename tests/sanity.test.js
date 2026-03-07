import assert from "node:assert";
import { test } from "node:test";

import { bootify } from "../src/plugin.js";

test("bootify function exists", () => {
    assert.strictEqual(typeof bootify, "function");
});
