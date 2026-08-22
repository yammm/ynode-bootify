import assert from "node:assert/strict";
import cluster from "node:cluster";
import { test } from "node:test";

import { start } from "../src/worker.js";
import { createLogStub } from "../test-utils/log-stub.js";

test("idle Autoshutdown runs Bootify onShutdown exactly once before process exit", async () => {
    const previousWorkerFlag = cluster.isWorker;
    const originalExit = process.exit;
    const shutdownSignals = [];
    let resolveExit;
    const exited = new Promise((resolve) => {
        resolveExit = resolve;
    });

    cluster.isWorker = true;
    process.exit = (code) => resolveExit(code);
    try {
        await start({
            app: async () => async () => {},
            config: {
                listen: { host: "127.0.0.1", port: 0 },
                sleep: { sleep: 0.05, grace: 0, jitter: 0 },
            },
            log: createLogStub(),
            pkg: { name: "test", version: "1.0.0" },
            hooks: {
                onShutdown: ({ signal }) => shutdownSignals.push(signal),
            },
        });

        let timeout;
        const timeoutPromise = new Promise((_, reject) => {
            timeout = setTimeout(() => reject(new Error("Autoshutdown did not exit")), 2000);
        });
        let code;
        try {
            code = await Promise.race([exited, timeoutPromise]);
        } finally {
            clearTimeout(timeout);
        }
        assert.strictEqual(code, 0);
        assert.deepStrictEqual(shutdownSignals, ["idle_timer"]);
    } finally {
        process.exit = originalExit;
        cluster.isWorker = previousWorkerFlag;
    }
});

test("an Autoshutdown veto leaves Bootify resources and shutdown signal active", async () => {
    const previousWorkerFlag = cluster.isWorker;
    const shutdownSignals = [];
    let workerApp;
    let resolveVeto;
    const vetoed = new Promise((resolve) => {
        resolveVeto = resolve;
    });

    cluster.isWorker = true;
    try {
        await start({
            app: async (fastify) => {
                workerApp = fastify;
                return async (instance) => {
                    instance.onAutoShutdown(() => false);
                    instance.onAutoShutdownComplete((event) => {
                        if (event.outcome === "vetoed") {
                            resolveVeto();
                        }
                    });
                };
            },
            config: {
                listen: { host: "127.0.0.1", port: 0 },
                sleep: { sleep: 0.05, grace: 0, jitter: 0 },
            },
            log: createLogStub(),
            pkg: { name: "test", version: "1.0.0" },
            hooks: {
                onShutdown: ({ signal }) => shutdownSignals.push(signal),
            },
        });

        await vetoed;
        assert.deepStrictEqual(shutdownSignals, []);
        assert.strictEqual(workerApp.server.listening, true);
    } finally {
        await workerApp?.close();
        cluster.isWorker = previousWorkerFlag;
    }

    assert.deepStrictEqual(shutdownSignals, ["fastify-close"]);
});
