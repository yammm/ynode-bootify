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

    worker.emit("message", {
        cmd: "cluster-count",
        count: 7,
        minWorkers: 2,
        maxWorkers: 9,
        mode: "max",
    });
    assert.strictEqual(fastify.clusterCount, 7);
    assert.strictEqual(fastify.clusterMinWorkers, 2);
    assert.strictEqual(fastify.clusterMaxWorkers, 9);
    assert.strictEqual(fastify.clusterMode, "max");

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
    await controller.handleFastifyClose();

    controller.dispose();
});

test("autoshutdown and Fastify close run the application shutdown hook exactly once", async () => {
    const signalTarget = new EventEmitter();
    const fastify = createFastifyDouble();
    const shutdownSignals = [];
    const controller = createLifecycleController({
        fastify,
        config: {},
        pkg: { name: "test", version: "1.0.0" },
        hooks: {
            onShutdown: ({ signal }) => shutdownSignals.push(signal),
        },
        signalTarget,
        worker: null,
    });

    await controller.handleAutoShutdownStart({ trigger: "idle_timer" });
    await controller.handleFastifyClose();
    await controller.handleFastifyClose();

    assert.deepStrictEqual(shutdownSignals, ["idle_timer"]);
    assert.strictEqual(signalTarget.listenerCount("SIGTERM"), 0);
});

test("Fastify close surfaces an autoshutdown hook failure once", async () => {
    const controller = createLifecycleController({
        fastify: createFastifyDouble(),
        config: {},
        pkg: { name: "test", version: "1.0.0" },
        hooks: {
            onShutdown: () => {
                throw new Error("autoshutdown-hook-failed");
            },
        },
        signalTarget: new EventEmitter(),
        worker: null,
    });

    await assert.rejects(
        () => controller.handleAutoShutdownStart({ trigger: "idle_timer" }),
        /autoshutdown-hook-failed/,
    );
    await assert.rejects(() => controller.handleFastifyClose(), /autoshutdown-hook-failed/);
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

test("createLifecycleController accepts zero and ignores invalid cluster-count payloads", async () => {
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
    assert.strictEqual(fastify.clusterCount, 0);

    worker.emit("message", { cmd: "cluster-count", count: -1 });
    worker.emit("message", { cmd: "cluster-count", count: "2" });
    await Promise.resolve();

    assert.strictEqual(fastify.clusterCount, 0);

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

test("graceful shutdown evicts idle connections without aborting active connections", async () => {
    const connectionCalls = [];
    const fastify = createFastifyDouble();
    fastify.server = {
        listening: true,
        close() {
            connectionCalls.push("close");
        },
        closeIdleConnections() {
            connectionCalls.push("close-idle");
        },
        closeAllConnections() {
            connectionCalls.push("close-all");
        },
    };

    const controller = createLifecycleController({
        fastify,
        config: {},
        pkg: { name: "test", version: "1.0.0" },
        signalTarget: new EventEmitter(),
        worker: null,
    });

    await controller.gracefulShutdown("SIGTERM");

    assert.deepStrictEqual(connectionCalls, ["close", "close-idle"]);
    assert.strictEqual(fastify.closeCalls, 1);
    controller.dispose();
});

test("cluster retirement evicts active connections before Fastify closing state", async () => {
    const connectionCalls = [];
    const fastify = createFastifyDouble();
    fastify.server = {
        listening: true,
        close() {
            connectionCalls.push("close");
        },
        closeIdleConnections() {
            connectionCalls.push("close-idle");
        },
        closeAllConnections() {
            connectionCalls.push("close-all");
        },
    };

    const controller = createLifecycleController({
        fastify,
        config: {},
        pkg: { name: "test", version: "1.0.0" },
        signalTarget: new EventEmitter(),
        worker: null,
    });

    await controller.gracefulShutdown("shutdown");

    assert.deepStrictEqual(connectionCalls, ["close", "close-all"]);
    assert.strictEqual(fastify.closeCalls, 1);
    controller.dispose();
});

test("first OS signal joins an IPC-initiated drain instead of forcing exit", async () => {
    const signalTarget = new EventEmitter();
    const exitCodes = [];
    signalTarget.exit = (code) => exitCodes.push(code);
    const worker = new EventEmitter();
    worker.isConnected = () => true;
    worker.disconnect = () => {};
    let finishShutdown = null;
    const shutdownGate = new Promise((resolve) => {
        finishShutdown = resolve;
    });

    const controller = createLifecycleController({
        fastify: createFastifyDouble(),
        config: { cluster: { shutdownTimeout: 100 } },
        pkg: { name: "test", version: "1.0.0" },
        hooks: { onShutdown: () => shutdownGate },
        signalTarget,
        processTarget: signalTarget,
        worker,
    });

    worker.emit("message", "shutdown");
    await Promise.resolve();
    signalTarget.emit("SIGTERM");

    assert.deepStrictEqual(exitCodes, []);

    finishShutdown();
    await controller.gracefulShutdown("shutdown");
    await new Promise((resolve) => setImmediate(resolve));

    assert.deepStrictEqual(exitCodes, [0]);
    controller.dispose();
});

test("second OS signal force-exits an already signaled worker", async () => {
    const signalTarget = new EventEmitter();
    const exitCodes = [];
    signalTarget.exit = (code) => exitCodes.push(code);
    let finishShutdown = null;
    const shutdownGate = new Promise((resolve) => {
        finishShutdown = resolve;
    });

    const controller = createLifecycleController({
        fastify: createFastifyDouble(),
        config: { cluster: { shutdownTimeout: 100 } },
        pkg: { name: "test", version: "1.0.0" },
        hooks: { onShutdown: () => shutdownGate },
        signalTarget,
        processTarget: signalTarget,
        worker: null,
    });

    signalTarget.emit("SIGTERM");
    signalTarget.emit("SIGINT");

    assert.deepStrictEqual(exitCodes, [1]);

    finishShutdown();
    await controller.gracefulShutdown("SIGTERM");
    controller.dispose();
});

test("worker reply delivery failures are logged instead of escaping", () => {
    const signalTarget = new EventEmitter();
    const worker = new EventEmitter();
    const deliveryError = new Error("channel closed");
    const replies = [];
    worker.send = (message, callback) => {
        replies.push(message);
        callback(deliveryError);
    };
    const warnings = [];
    const fastify = createFastifyDouble();
    fastify.log.warn = (...args) => warnings.push(args);

    const controller = createLifecycleController({
        fastify,
        config: {},
        pkg: { name: "test", version: "1.2.3" },
        signalTarget,
        worker,
    });

    worker.emit("message", { cmd: "ping" });
    worker.emit("message", { cmd: "version" });

    assert.strictEqual(replies.length, 2);
    assert.strictEqual(replies[0].cmd, "ping");
    assert.deepStrictEqual(replies[1], {
        cmd: "version",
        appVersion: "1.2.3",
        nodeVersion: process.version,
    });
    assert.strictEqual(warnings.length, 2);
    assert.deepStrictEqual(warnings[0][0], { err: deliveryError });
    assert.match(warnings[0][1], /ping reply/);
    assert.match(warnings[1][1], /version reply/);
    controller.dispose();
});

test("synchronous worker reply failures are logged instead of escaping", () => {
    const worker = new EventEmitter();
    const sendError = new Error("send failed");
    worker.send = () => {
        throw sendError;
    };
    const warnings = [];
    const fastify = createFastifyDouble();
    fastify.log.warn = (...args) => warnings.push(args);

    const controller = createLifecycleController({
        fastify,
        config: {},
        pkg: { name: "test", version: "1.0.0" },
        signalTarget: new EventEmitter(),
        worker,
    });

    assert.doesNotThrow(() => worker.emit("message", { cmd: "ping" }));
    assert.deepStrictEqual(warnings, [[{ err: sendError }, "Failed to send worker ping reply."]]);
    controller.dispose();
});
