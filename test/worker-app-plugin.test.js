import assert from "node:assert/strict";
import { test } from "node:test";
import { start } from "../src/worker.js";
import { createLogStub } from "../test-utils/log-stub.js";

test("start rejects app result when not a plugin function", async () => {
    await assert.rejects(
        () =>
            start({
                app: async () => ({}),
                config: { listen: 0, environment: "test" },
                log: createLogStub(),
                pkg: { name: "test", version: "1.0.0" },
            }),
        /Invalid app plugin/,
    );
});

test("start rejects app module with non-function default export", async () => {
    await assert.rejects(
        () =>
            start({
                app: async () => ({ default: "not-a-function" }),
                config: { listen: 0, environment: "test" },
                log: createLogStub(),
                pkg: { name: "test", version: "1.0.0" },
            }),
        /Invalid app plugin/,
    );
});
