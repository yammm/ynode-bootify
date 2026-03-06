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

function createBootifyState(state = "idle") {
    let current = state;
    return {
        getBootifyState: () => current,
        setBootifyState: (nextState) => {
            current = nextState;
        },
    };
}

test("bootify rejects repeated valid invocations", async () => {
    const processTarget = new EventEmitter();
    let runCalls = 0;
    const bootifyState = createBootifyState();

    const options = {
        app: async () => async () => {},
        config: { cluster: false },
        pkg: { name: "test", version: "1.0.0" },
        _internal: {
            process: processTarget,
            ylog: () => createLogStub(),
            ...bootifyState,
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
    const bootifyState = createBootifyState();
    const pidfileCalls = [];

    await bootify({
        app: async () => async () => {},
        config: { cluster: false, pidfile: "/tmp/ynode-bootify.pid" },
        pkg: { name: "test", version: "1.0.0" },
        _internal: {
            process: processTarget,
            ylog: () => createLogStub(),
            ...bootifyState,
            run: async () => ({}),
            mkpidfile: (path) => {
                pidfileCalls.push(path);
            },
        },
    });

    assert.deepStrictEqual(pidfileCalls, ["/tmp/ynode-bootify.pid"]);
});

test("bootify allows retry after failed startup", async () => {
    const processTarget = new EventEmitter();
    const bootifyState = createBootifyState();
    let runCalls = 0;

    const options = {
        app: async () => async () => {},
        config: { cluster: false },
        pkg: { name: "test", version: "1.0.0" },
        _internal: {
            process: processTarget,
            ylog: () => createLogStub(),
            ...bootifyState,
            run: async () => {
                runCalls += 1;
                if (runCalls === 1) {
                    throw new Error("startup failed");
                }
                return {};
            },
        },
    };

    await assert.rejects(() => bootify(options), /startup failed/);
    assert.strictEqual(processTarget.listenerCount("SIGQUIT"), 0);
    assert.strictEqual(processTarget.listenerCount("exit"), 0);
    assert.strictEqual(processTarget.listenerCount("SIGHUP"), 0);
    await assert.doesNotReject(() => bootify(options));
    assert.strictEqual(runCalls, 2);
});

test("bootify rejects concurrent call while startup is in progress", async () => {
    const processTarget = new EventEmitter();
    const bootifyState = createBootifyState();
    let resolveRun = null;

    const runPromise = new Promise((resolve) => {
        resolveRun = resolve;
    });

    const options = {
        app: async () => async () => {},
        config: { cluster: false },
        pkg: { name: "test", version: "1.0.0" },
        _internal: {
            process: processTarget,
            ylog: () => createLogStub(),
            ...bootifyState,
            run: async () => runPromise,
        },
    };

    const firstBoot = bootify(options);
    await assert.rejects(() => bootify(options), /bootify\(\) is already starting in this process/);

    resolveRun({});
    await firstBoot;
});

test("bootify registers SIGQUIT/exit and wires SIGHUP reload handler", async () => {
    const processTarget = new EventEmitter();
    const bootifyState = createBootifyState();
    let reloadCalls = 0;

    await bootify({
        app: async () => async () => {},
        config: { cluster: true },
        pkg: { name: "test", version: "1.0.0" },
        _internal: {
            process: processTarget,
            ylog: () => createLogStub(),
            ...bootifyState,
            run: async () => ({
                reload: async () => {
                    reloadCalls += 1;
                },
            }),
        },
    });

    assert.strictEqual(processTarget.listenerCount("SIGQUIT"), 1);
    assert.strictEqual(processTarget.listenerCount("exit"), 1);
    assert.strictEqual(processTarget.listenerCount("SIGHUP"), 1);

    processTarget.emit("SIGHUP");
    assert.strictEqual(reloadCalls, 1);
});

test("bootify skips SIGHUP wiring when manager has no reload method", async () => {
    const processTarget = new EventEmitter();
    const bootifyState = createBootifyState();

    await bootify({
        app: async () => async () => {},
        config: { cluster: true },
        pkg: { name: "test", version: "1.0.0" },
        _internal: {
            process: processTarget,
            ylog: () => createLogStub(),
            ...bootifyState,
            run: async () => ({}),
        },
    });

    assert.strictEqual(processTarget.listenerCount("SIGQUIT"), 1);
    assert.strictEqual(processTarget.listenerCount("exit"), 1);
    assert.strictEqual(processTarget.listenerCount("SIGHUP"), 0);
});
