import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { test } from "node:test";
import { bootify } from "../src/index.js";

function createLogStub() {
    return {
        level: "info",
        fatal() {},
        error() {},
        warn() {},
        info() {},
        debug() {},
        trace() {},
        child() {
            return this;
        },
    };
}

test("bootify rejects repeated valid invocations", async () => {
    const processTarget = new EventEmitter();
    let runCalls = 0;

    const options = {
        app: async () => async () => {},
        config: { cluster: false },
        pkg: { name: "test", version: "1.0.0" },
        _internal: {
            process: processTarget,
            ylog: () => createLogStub(),
            run: async () => {
                runCalls += 1;
                return {};
            },
        },
    };

    await bootify(options);
    await assert.rejects(() => bootify(options), /can only be called once per process/);
    assert.strictEqual(runCalls, 1);
});
