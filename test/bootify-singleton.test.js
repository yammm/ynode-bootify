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

function createSingletonState(started = false) {
    let active = started;
    return {
        isBootifyStarted: () => active,
        markBootifyStarted: () => {
            active = true;
        },
    };
}

test("bootify rejects repeated valid invocations", async () => {
    const processTarget = new EventEmitter();
    let runCalls = 0;
    const singleton = createSingletonState();

    const options = {
        app: async () => async () => {},
        config: { cluster: false },
        pkg: { name: "test", version: "1.0.0" },
        _internal: {
            process: processTarget,
            ylog: () => createLogStub(),
            ...singleton,
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

test("bootify creates pidfile when pidfile config is set", async () => {
    const processTarget = new EventEmitter();
    const singleton = createSingletonState();
    const pidfileCalls = [];

    await bootify({
        app: async () => async () => {},
        config: { cluster: false, pidfile: "/tmp/ynode-bootify.pid" },
        pkg: { name: "test", version: "1.0.0" },
        _internal: {
            process: processTarget,
            ylog: () => createLogStub(),
            ...singleton,
            run: async () => ({}),
            mkpidfile: (path) => {
                pidfileCalls.push(path);
            },
        },
    });

    assert.deepStrictEqual(pidfileCalls, ["/tmp/ynode-bootify.pid"]);
});
