import assert from "node:assert/strict";
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
