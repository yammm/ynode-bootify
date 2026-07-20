import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { test } from "node:test";

import { createLifecycleController } from "../src/worker.js";

function createFastifyDouble() {
    return {
        clusterCount: 1,
        closeCalls: 0,
        async close() {
            this.closeCalls += 1;
        },
        log: {
            error() {},
            warn() {},
        },
    };
}

test("createLifecycleController handles repeated signals idempotently", async () => {
    const signalTarget = new EventEmitter();
    const fastify = createFastifyDouble();
    const shutdownSignals = [];

    const controller = createLifecycleController({
        fastify,
        config: {},
        pkg: { name: "test", version: "1.0.0" },
        hooks: {
            onShutdown: ({ signal }) => {
                shutdownSignals.push(signal);
            },
        },
        signalTarget,
        worker: null,
    });

    signalTarget.emit("SIGTERM");
    signalTarget.emit("SIGTERM");

    await controller.gracefulShutdown("SIGTERM");

    assert.deepStrictEqual(shutdownSignals, ["SIGTERM"]);
    assert.strictEqual(fastify.closeCalls, 1);

    controller.dispose();
    assert.strictEqual(signalTarget.listenerCount("SIGTERM"), 0);
});

test("createLifecycleController applies worker cluster updates and shutdown command", async () => {
    const signalTarget = new EventEmitter();
    const worker = new EventEmitter();
    worker.disconnect = () => {};
    const fastify = createFastifyDouble();
    const shutdownSignals = [];

    const controller = createLifecycleController({
        fastify,
        config: {},
        pkg: { name: "test", version: "1.0.0" },
        hooks: {
            onShutdown: ({ signal }) => {
                shutdownSignals.push(signal);
            },
        },
        signalTarget,
        worker,
    });

    worker.emit("message", { cmd: "cluster-count", count: 7 });
    assert.strictEqual(fastify.clusterCount, 7);

    worker.emit("message", "shutdown");
    await controller.gracefulShutdown("shutdown");

    assert.deepStrictEqual(shutdownSignals, ["shutdown"]);
    assert.strictEqual(fastify.closeCalls, 1);

    controller.dispose();
    assert.strictEqual(worker.listenerCount("message"), 0);
});

test("createLifecycleController dispose removes signal listeners", () => {
    const signalTarget = new EventEmitter();
    const fastify = createFastifyDouble();

    const controller = createLifecycleController({
        fastify,
        config: {},
        pkg: { name: "test", version: "1.0.0" },
        signalTarget,
        worker: null,
    });

    assert.strictEqual(signalTarget.listenerCount("SIGINT"), 1);
    assert.strictEqual(signalTarget.listenerCount("SIGTERM"), 1);
    assert.strictEqual(signalTarget.listenerCount("SIGQUIT"), 1);
    assert.strictEqual(signalTarget.listenerCount("SIGUSR2"), 1);

    controller.dispose();

    assert.strictEqual(signalTarget.listenerCount("SIGINT"), 0);
    assert.strictEqual(signalTarget.listenerCount("SIGTERM"), 0);
    assert.strictEqual(signalTarget.listenerCount("SIGQUIT"), 0);
    assert.strictEqual(signalTarget.listenerCount("SIGUSR2"), 0);
});

test("createLifecycleController dispose is idempotent", () => {
    const signalTarget = new EventEmitter();
    const worker = new EventEmitter();
    worker.disconnect = () => {};
    const fastify = createFastifyDouble();

    const controller = createLifecycleController({
        fastify,
        config: {},
        pkg: { name: "test", version: "1.0.0" },
        signalTarget,
        worker,
    });

    controller.dispose();
    // dispose is wired into both fastify.onClose and start.js's
    // try/finally cleanup path; calling it a second time must be a no-op.
    assert.doesNotThrow(() => controller.dispose());
    assert.strictEqual(signalTarget.listenerCount("SIGINT"), 0);
    assert.strictEqual(worker.listenerCount("message"), 0);
});

test("createLifecycleController still closes fastify when onShutdown hook throws", async () => {
    const signalTarget = new EventEmitter();
    const fastify = createFastifyDouble();

    const controller = createLifecycleController({
        fastify,
        config: {},
        pkg: { name: "test", version: "1.0.0" },
        hooks: {
            onShutdown: () => {
                throw new Error("hook-failed");
            },
        },
        signalTarget,
        worker: null,
    });

    await assert.rejects(() => controller.gracefulShutdown("SIGTERM"), /hook-failed/);
    assert.strictEqual(fastify.closeCalls, 1);

    controller.dispose();
});

test("createLifecycleController ignores null worker messages", async () => {
    const signalTarget = new EventEmitter();
    const worker = new EventEmitter();
    const fastify = createFastifyDouble();

    const controller = createLifecycleController({
        fastify,
        config: {},
        pkg: { name: "test", version: "1.0.0" },
        signalTarget,
        worker,
    });

    worker.emit("message", null);
    await Promise.resolve();

    worker.emit("message", { cmd: "cluster-count", count: 3 });
    assert.strictEqual(fastify.clusterCount, 3);

    controller.dispose();
});

test("createLifecycleController ignores invalid cluster-count payloads", async () => {
    const signalTarget = new EventEmitter();
    const worker = new EventEmitter();
    const fastify = createFastifyDouble();

    const controller = createLifecycleController({
        fastify,
        config: {},
        pkg: { name: "test", version: "1.0.0" },
        signalTarget,
        worker,
    });

    worker.emit("message", { cmd: "cluster-count", count: 0 });
    worker.emit("message", { cmd: "cluster-count", count: -1 });
    worker.emit("message", { cmd: "cluster-count", count: "2" });
    await Promise.resolve();

    assert.strictEqual(fastify.clusterCount, 1);

    worker.emit("message", { cmd: "cluster-count", count: 4 });
    assert.strictEqual(fastify.clusterCount, 4);

    controller.dispose();
});

test("direct worker signals close, disconnect, and exit cleanly", async () => {
    const processTarget = new EventEmitter();
    const exitCodes = [];
    processTarget.exit = (code) => exitCodes.push(code);
    const worker = new EventEmitter();
    worker.isConnected = () => true;
    let disconnectCalls = 0;
    worker.disconnect = () => {
        disconnectCalls += 1;
    };
    const fastify = createFastifyDouble();

    const controller = createLifecycleController({
        fastify,
        config: { cluster: { shutdownTimeout: 100 } },
        pkg: { name: "test", version: "1.0.0" },
        signalTarget: processTarget,
        processTarget,
        worker,
    });

    processTarget.emit("SIGQUIT");
    await new Promise((resolve) => setImmediate(resolve));

    assert.strictEqual(fastify.closeCalls, 1);
    assert.strictEqual(disconnectCalls, 1);
    assert.deepStrictEqual(exitCodes, [0]);
    controller.dispose();
});

test("worker shutdown timeout disconnects and exits non-zero", async () => {
    const processTarget = new EventEmitter();
    const exitCodes = [];
    processTarget.exit = (code) => exitCodes.push(code);
    const worker = new EventEmitter();
    worker.isConnected = () => true;
    let disconnectCalls = 0;
    worker.disconnect = () => {
        disconnectCalls += 1;
    };
    const fastify = createFastifyDouble();

    const controller = createLifecycleController({
        fastify,
        config: { cluster: { shutdownTimeout: 10 } },
        pkg: { name: "test", version: "1.0.0" },
        hooks: { onShutdown: () => new Promise(() => {}) },
        signalTarget: processTarget,
        processTarget,
        worker,
    });

    worker.emit("message", "shutdown");
    await new Promise((resolve) => setTimeout(resolve, 30));

    assert.strictEqual(disconnectCalls, 1);
    assert.deepStrictEqual(exitCodes, [1]);
    controller.dispose();
});
