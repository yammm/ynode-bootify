import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";
import { test } from "node:test";

import { createLifecycleController, start } from "../src/worker.js";

function createFastifyStub() {
    const closeHooks = [];

    return {
        closeCalls: 0,
        log: {
            error() {},
        },
        server: {
            address() {
                return { address: "127.0.0.1", family: "IPv4", port: 0 };
            },
        },
        decorate(key, value) {
            this[key] = value;
        },
        register() {},
        addHook(name, fn) {
            if (name === "onClose") {
                closeHooks.push(fn);
            }
        },
        async close() {
            this.closeCalls += 1;
            for (const hook of closeHooks) {
                await hook();
            }
        },
    };
}

test("start disposes signal listeners when startup fails before listen completes", async () => {
    const signalTarget = new EventEmitter();
    const fastify = createFastifyStub();
    const startupError = new Error("listen failed");

    await assert.rejects(
        () =>
            start({
                app: async () => async () => {},
                config: { listen: 0, environment: "test" },
                log: fastify.log,
                pkg: { name: "test", version: "1.0.0" },
                _internal: {
                    createServer: async () => fastify,
                    listen: async () => {
                        throw startupError;
                    },
                    createLifecycleController: (context) =>
                        createLifecycleController({
                            ...context,
                            signalTarget,
                            worker: null,
                        }),
                },
            }),
        startupError,
    );

    assert.strictEqual(fastify.closeCalls, 1);
    assert.strictEqual(signalTarget.listenerCount("SIGINT"), 0);
    assert.strictEqual(signalTarget.listenerCount("SIGTERM"), 0);
    assert.strictEqual(signalTarget.listenerCount("SIGUSR2"), 0);
});

test("start closes server and disposes listeners when app bootstrap fails", async () => {
    const signalTarget = new EventEmitter();
    const fastify = createFastifyStub();
    const startupError = new Error("app failed");
    let listenCalls = 0;

    await assert.rejects(
        () =>
            start({
                app: async () => {
                    throw startupError;
                },
                config: { listen: 0, environment: "test" },
                log: fastify.log,
                pkg: { name: "test", version: "1.0.0" },
                _internal: {
                    createServer: async () => fastify,
                    listen: async () => {
                        listenCalls += 1;
                    },
                    createLifecycleController: (context) =>
                        createLifecycleController({
                            ...context,
                            signalTarget,
                            worker: null,
                        }),
                },
            }),
        startupError,
    );

    assert.strictEqual(listenCalls, 0);
    assert.strictEqual(fastify.closeCalls, 1);
    assert.strictEqual(signalTarget.listenerCount("SIGINT"), 0);
    assert.strictEqual(signalTarget.listenerCount("SIGTERM"), 0);
    assert.strictEqual(signalTarget.listenerCount("SIGUSR2"), 0);
});

test("start closes server when onBeforeListen hook throws", async () => {
    const signalTarget = new EventEmitter();
    const fastify = createFastifyStub();
    const startupError = new Error("before-listen failed");
    const shutdownSignals = [];
    let listenCalls = 0;

    await assert.rejects(
        () =>
            start({
                app: async () => async () => {},
                config: { listen: 0, environment: "test" },
                log: fastify.log,
                pkg: { name: "test", version: "1.0.0" },
                hooks: {
                    onBeforeListen: async () => {
                        throw startupError;
                    },
                    onShutdown: ({ signal }) => {
                        shutdownSignals.push(signal);
                    },
                },
                _internal: {
                    createServer: async () => fastify,
                    listen: async () => {
                        listenCalls += 1;
                    },
                    createLifecycleController: (context) =>
                        createLifecycleController({
                            ...context,
                            signalTarget,
                            worker: null,
                        }),
                },
            }),
        startupError,
    );

    assert.strictEqual(listenCalls, 0);
    assert.strictEqual(fastify.closeCalls, 1);
    assert.deepStrictEqual(shutdownSignals, ["startup-error"]);
    assert.strictEqual(signalTarget.listenerCount("SIGINT"), 0);
    assert.strictEqual(signalTarget.listenerCount("SIGTERM"), 0);
    assert.strictEqual(signalTarget.listenerCount("SIGUSR2"), 0);
});

test("start closes server when onAfterListen hook throws", async () => {
    const signalTarget = new EventEmitter();
    const fastify = createFastifyStub();
    const startupError = new Error("after-listen failed");
    const shutdownSignals = [];
    let listenCalls = 0;

    await assert.rejects(
        () =>
            start({
                app: async () => async () => {},
                config: { listen: 0, environment: "test" },
                log: fastify.log,
                pkg: { name: "test", version: "1.0.0" },
                hooks: {
                    onAfterListen: async () => {
                        throw startupError;
                    },
                    onShutdown: ({ signal }) => {
                        shutdownSignals.push(signal);
                    },
                },
                _internal: {
                    createServer: async () => fastify,
                    listen: async () => {
                        listenCalls += 1;
                    },
                    createLifecycleController: (context) =>
                        createLifecycleController({
                            ...context,
                            signalTarget,
                            worker: null,
                        }),
                },
            }),
        startupError,
    );

    assert.strictEqual(listenCalls, 1);
    assert.strictEqual(fastify.closeCalls, 1);
    assert.deepStrictEqual(shutdownSignals, ["onAfterListen-error"]);
    assert.strictEqual(signalTarget.listenerCount("SIGINT"), 0);
    assert.strictEqual(signalTarget.listenerCount("SIGTERM"), 0);
    assert.strictEqual(signalTarget.listenerCount("SIGUSR2"), 0);
});

test("start bounds shutdown-hook cleanup and preserves the startup error", async () => {
    const signalTarget = new EventEmitter();
    const fastify = createFastifyStub();
    const startupError = new Error("before-listen failed");
    let guardTimer = null;

    const startPromise = start({
        app: async () => async () => {},
        config: {
            cluster: { shutdownTimeout: 10 },
            listen: 0,
            environment: "test",
        },
        log: fastify.log,
        pkg: { name: "test", version: "1.0.0" },
        hooks: {
            onBeforeListen: async () => {
                throw startupError;
            },
            onShutdown: () => new Promise(() => {}),
        },
        _internal: {
            createServer: async () => fastify,
            createLifecycleController: (context) =>
                createLifecycleController({
                    ...context,
                    signalTarget,
                    worker: null,
                }),
        },
    });

    const guardPromise = new Promise((_, reject) => {
        guardTimer = setTimeout(() => reject(new Error("startup cleanup did not settle")), 250);
    });

    try {
        await assert.rejects(Promise.race([startPromise, guardPromise]), (err) => {
            assert.strictEqual(err, startupError);
            return true;
        });
    } finally {
        clearTimeout(guardTimer);
    }

    assert.strictEqual(signalTarget.listenerCount("SIGINT"), 0);
    assert.strictEqual(signalTarget.listenerCount("SIGTERM"), 0);
    assert.strictEqual(signalTarget.listenerCount("SIGUSR2"), 0);
});

test("startup cleanup deadline remains active without other referenced handles", () => {
    const workerUrl = new URL("../src/worker.js", import.meta.url).href;
    const script = `
        import { start } from ${JSON.stringify(workerUrl)};

        const closeHooks = [];
        const fastify = {
            log: { error() {} },
            server: {
                address() {
                    return { address: "127.0.0.1", family: "IPv4", port: 0 };
                },
            },
            decorate(key, value) {
                this[key] = value;
            },
            register() {},
            addHook(name, fn) {
                if (name === "onClose") closeHooks.push(fn);
            },
            async close() {
                for (const hook of closeHooks) await hook();
            },
        };
        const startupError = new Error("before-listen failed");

        try {
            await start({
                app: async () => async () => {},
                config: { cluster: { shutdownTimeout: 10 }, listen: 0 },
                log: fastify.log,
                pkg: { name: "test", version: "1.0.0" },
                hooks: {
                    onBeforeListen: async () => { throw startupError; },
                    onShutdown: () => new Promise(() => {}),
                },
                _internal: { createServer: async () => fastify },
            });
        } catch (ex) {
            if (ex === startupError) {
                process.stdout.write("settled");
                process.exit(0);
            }
        }
        process.exit(2);
    `;

    const child = spawnSync(process.execPath, ["--input-type=module", "--eval", script], {
        encoding: "utf8",
        timeout: 1000,
    });

    assert.strictEqual(child.signal, null, child.stderr);
    assert.strictEqual(child.status, 0, child.stderr);
    assert.strictEqual(child.stdout, "settled");
});

test("start treats IPC shutdown during a listen retry as clean cancellation", async () => {
    const signalTarget = new EventEmitter();
    const worker = new EventEmitter();
    worker.isConnected = () => true;
    let disconnectCalls = 0;
    worker.disconnect = () => {
        disconnectCalls += 1;
    };
    const fastify = createFastifyStub();
    let listenCalls = 0;
    fastify.listen = async () => {
        listenCalls += 1;
        worker.emit("message", "shutdown");
        throw new Error("address busy");
    };

    await assert.doesNotReject(() =>
        start({
            app: async () => async () => {},
            config: {
                cluster: { shutdownTimeout: 100 },
                listen: 3000,
                listenRetry: { retries: 3, delay: 1000 },
            },
            log: fastify.log,
            pkg: { name: "test", version: "1.0.0" },
            _internal: {
                createServer: async () => fastify,
                createLifecycleController: (context) =>
                    createLifecycleController({
                        ...context,
                        signalTarget,
                        processTarget: signalTarget,
                        worker,
                    }),
            },
        }),
    );

    assert.strictEqual(listenCalls, 1);
    assert.strictEqual(fastify.closeCalls, 1);
    assert.strictEqual(disconnectCalls, 1);
    assert.strictEqual(signalTarget.listenerCount("SIGTERM"), 0);
});
