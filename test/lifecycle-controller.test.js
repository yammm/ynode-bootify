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
    assert.strictEqual(signalTarget.listenerCount("SIGUSR2"), 1);

    controller.dispose();

    assert.strictEqual(signalTarget.listenerCount("SIGINT"), 0);
    assert.strictEqual(signalTarget.listenerCount("SIGTERM"), 0);
    assert.strictEqual(signalTarget.listenerCount("SIGUSR2"), 0);
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
