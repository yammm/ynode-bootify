import assert from "node:assert/strict";
import cluster from "node:cluster";
import { test } from "node:test";
import { createServer } from "../src/server.js";

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

async function withWorkerFlag(workerFlag, fn) {
    const previous = cluster.isWorker;
    cluster.isWorker = workerFlag;
    try {
        await fn();
    } finally {
        cluster.isWorker = previous;
    }
}

test("createServer applies URL rewrite config and preserves query string", async () => {
    await withWorkerFlag(false, async () => {
        const fastify = await createServer({ rewrite: { "/from": "/to" } }, createLogStub());
        fastify.get("/to", async (request) => ({
            url: request.url,
            route: request.routeOptions.url,
        }));
        await fastify.ready();

        const response = await fastify.inject({ method: "GET", url: "/from?a=1&b=2" });
        assert.strictEqual(response.statusCode, 200);
        assert.deepStrictEqual(response.json(), { url: "/to?a=1&b=2", route: "/to" });

        await fastify.close();
    });
});

test("createServer honors trustProxy for forwarded client IP", async () => {
    await withWorkerFlag(false, async () => {
        const createApp = async (trustProxy) => {
            const app = await createServer({ trustProxy }, createLogStub());
            app.get("/ip", async (request) => ({ ip: request.ip }));
            await app.ready();
            return app;
        };

        const appWithoutTrustProxy = await createApp(false);
        const directIpResponse = await appWithoutTrustProxy.inject({
            method: "GET",
            url: "/ip",
            headers: { "x-forwarded-for": "203.0.113.10" },
        });
        assert.deepStrictEqual(directIpResponse.json(), { ip: "127.0.0.1" });
        await appWithoutTrustProxy.close();

        const appWithTrustProxy = await createApp(true);
        const forwardedIpResponse = await appWithTrustProxy.inject({
            method: "GET",
            url: "/ip",
            headers: { "x-forwarded-for": "203.0.113.10" },
        });
        assert.deepStrictEqual(forwardedIpResponse.json(), { ip: "203.0.113.10" });
        await appWithTrustProxy.close();
    });
});

test("createServer registers autoshutdown only for worker processes", async () => {
    await withWorkerFlag(false, async () => {
        const fastify = await createServer({}, createLogStub());
        await fastify.ready();
        assert.strictEqual(fastify.hasDecorator("autoshutdown"), false);
        await fastify.close();
    });

    await withWorkerFlag(true, async () => {
        const fastify = await createServer({}, createLogStub());
        await fastify.ready();
        assert.strictEqual(fastify.hasDecorator("autoshutdown"), true);
        await fastify.close();
    });
});

test("createServer enables HTTP/2 server when configured", async () => {
    await withWorkerFlag(false, async () => {
        const fastify = await createServer({ http2: true }, createLogStub());
        await fastify.ready();
        assert.strictEqual(fastify.server.constructor.name, "Http2Server");
        await fastify.close();
    });
});
