import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { test } from "node:test";

import { bootify } from "../src/plugin.js";
import { createLogStub } from "../test-utils/log-stub.js";

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

test("bootify defaults cluster config to enabled when config.cluster is omitted", async () => {
    const processTarget = new EventEmitter();
    const bootifyState = createBootifyState();
    let capturedRunOptions = null;

    await bootify({
        app: async () => async () => {},
        config: {},
        pkg: { name: "test", version: "1.0.0" },
        _internal: {
            process: processTarget,
            ylog: () => createLogStub(),
            ...bootifyState,
            run: async (_startWorker, options) => {
                capturedRunOptions = options;
                return {};
            },
        },
    });

    assert.deepStrictEqual(capturedRunOptions, { enabled: undefined });
});

test("bootify skips SIGHUP wiring when manager reload is not a function", async () => {
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
            run: async () => ({ reload: "nope" }),
        },
    });

    assert.strictEqual(processTarget.listenerCount("SIGQUIT"), 1);
    assert.strictEqual(processTarget.listenerCount("exit"), 1);
    assert.strictEqual(processTarget.listenerCount("SIGHUP"), 0);
});

test("bootify catches and logs SIGHUP-triggered reload failures", async () => {
    const processTarget = new EventEmitter();
    const bootifyState = createBootifyState();
    const reloadError = new Error("reload failed");
    const unhandledRejections = [];
    const errorLogs = [];
    const log = createLogStub();
    log.error = (...args) => {
        errorLogs.push(args);
    };

    const onUnhandledRejection = (reason) => {
        unhandledRejections.push(reason);
    };
    process.on("unhandledRejection", onUnhandledRejection);

    try {
        await bootify({
            app: async () => async () => {},
            config: { cluster: true },
            pkg: { name: "test", version: "1.0.0" },
            _internal: {
                process: processTarget,
                ylog: () => log,
                ...bootifyState,
                run: async () => ({
                    reload: async () => {
                        throw reloadError;
                    },
                }),
            },
        });

        processTarget.emit("SIGHUP");
        await new Promise((resolve) => setImmediate(resolve));
    } finally {
        process.off("unhandledRejection", onUnhandledRejection);
    }

    assert.strictEqual(unhandledRejections.length, 0);
    assert.strictEqual(errorLogs.length, 1);
    assert.strictEqual(errorLogs[0][0], reloadError);
    assert.match(errorLogs[0][1], /SIGHUP-triggered reload failed/);
});

test("bootify uses processTarget.abort for SIGQUIT", async () => {
    const processTarget = new EventEmitter();
    const bootifyState = createBootifyState();
    let targetAbortCalls = 0;
    processTarget.abort = () => {
        targetAbortCalls += 1;
    };

    const originalAbort = process.abort;
    let processAbortCalls = 0;
    process.abort = () => {
        processAbortCalls += 1;
    };

    try {
        await bootify({
            app: async () => async () => {},
            config: { cluster: false },
            pkg: { name: "test", version: "1.0.0" },
            _internal: {
                process: processTarget,
                ylog: () => createLogStub(),
                ...bootifyState,
                run: async () => ({}),
            },
        });

        processTarget.emit("SIGQUIT");
    } finally {
        process.abort = originalAbort;
    }

    assert.strictEqual(targetAbortCalls, 1);
    assert.strictEqual(processAbortCalls, 0);
});

test("bootify passes cluster.tty options through to cluster run()", async () => {
    const processTarget = new EventEmitter();
    const bootifyState = createBootifyState();
    let capturedRunOptions = null;

    const clusterOptions = {
        enabled: true,
        tty: {
            enabled: true,
            commands: true,
            reloadCommand: "rl",
            prompt: "cluster> ",
        },
    };

    await bootify({
        app: async () => async () => {},
        config: { cluster: clusterOptions },
        pkg: { name: "test", version: "1.0.0" },
        _internal: {
            process: processTarget,
            ylog: () => createLogStub(),
            ...bootifyState,
            run: async (_startWorker, options) => {
                capturedRunOptions = options;
                return {};
            },
        },
    });

    assert.deepStrictEqual(capturedRunOptions, clusterOptions);
});
