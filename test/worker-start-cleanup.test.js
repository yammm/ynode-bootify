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
