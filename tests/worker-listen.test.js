import assert from "node:assert/strict";
import { test } from "node:test";

import { parseListenConfig, resolveListenRetry } from "../src/worker.js";

test("parseListenConfig parses plain port with default host", () => {
    assert.deepStrictEqual(parseListenConfig("3000"), {
        port: 3000,
        host: "127.0.0.1",
    });
});

test("parseListenConfig parses host and port", () => {
    assert.deepStrictEqual(parseListenConfig("127.0.0.1:8080"), {
        port: 8080,
        host: "127.0.0.1",
    });
});

test("parseListenConfig parses bracketed IPv6 host and port", () => {
    assert.deepStrictEqual(parseListenConfig("[::1]:8080"), {
        port: 8080,
        host: "::1",
    });
});

test("parseListenConfig parses unix socket paths", () => {
    assert.deepStrictEqual(parseListenConfig("/tmp/app.sock"), {
        path: "/tmp/app.sock",
    });
});

test("parseListenConfig parses windows drive-letter paths", () => {
    assert.deepStrictEqual(parseListenConfig("C:\\tmp\\app.sock"), {
        path: "C:\\tmp\\app.sock",
    });
});

test("parseListenConfig parses object listen config with port and host", () => {
    assert.deepStrictEqual(parseListenConfig({ port: 8080, host: "0.0.0.0" }), {
        port: 8080,
        host: "0.0.0.0",
    });
});

test("parseListenConfig parses object listen config with default host", () => {
    assert.deepStrictEqual(parseListenConfig({ port: 3000 }), {
        port: 3000,
        host: "127.0.0.1",
    });
});

test("parseListenConfig parses object listen config with path and options", () => {
    assert.deepStrictEqual(parseListenConfig({ path: "/tmp/app.sock", readableAll: true }), {
        path: "/tmp/app.sock",
        readableAll: true,
    });
});

test("parseListenConfig rejects invalid listen backlog option", () => {
    assert.throws(
        () => parseListenConfig({ port: 3000, backlog: -1 }),
        /Invalid "listen\.backlog" option/,
    );
});

test("parseListenConfig rejects non-boolean listen flag options", () => {
    assert.throws(
        () => parseListenConfig({ port: 3000, readableAll: "yes" }),
        /Invalid "listen\.readableAll" option/,
    );
});

test("parseListenConfig rejects malformed host:port", () => {
    assert.throws(
        () => parseListenConfig("localhost:abc"),
        /Expected "host:port" or "\[ipv6\]:port" when using colons\./,
    );
});

test("parseListenConfig rejects unbracketed IPv6 with port", () => {
    assert.throws(
        () => parseListenConfig("::1:8080"),
        /Expected "host:port" or "\[ipv6\]:port" when using colons\./,
    );
});

test("parseListenConfig rejects invalid listen object shape", () => {
    assert.throws(
        () => parseListenConfig({ host: "127.0.0.1" }),
        /Expected either \{"path": "\.\.\."\} or \{"port": number, "host"\?: string\}\./,
    );
});

test("parseListenConfig rejects listen object with path and port together", () => {
    assert.throws(
        () => parseListenConfig({ path: "/tmp/app.sock", port: 3000 }),
        /"path" cannot be combined with "host" or "port"\./,
    );
});

test("resolveListenRetry returns defaults when unset", () => {
    assert.deepStrictEqual(resolveListenRetry({}), {
        retries: 5,
        delay: 15000,
    });
});

test("resolveListenRetry accepts partial config", () => {
    assert.deepStrictEqual(resolveListenRetry({ listenRetry: { retries: 2 } }), {
        retries: 2,
        delay: 15000,
    });
});

test("resolveListenRetry accepts full config", () => {
    assert.deepStrictEqual(resolveListenRetry({ listenRetry: { retries: 3, delay: 1000 } }), {
        retries: 3,
        delay: 1000,
    });
});

test("resolveListenRetry rejects non-object config", () => {
    assert.throws(() => resolveListenRetry({ listenRetry: 2 }), /Invalid "listenRetry" option/);
});

test("resolveListenRetry rejects invalid retries", () => {
    assert.throws(
        () => resolveListenRetry({ listenRetry: { retries: 0 } }),
        /Invalid "listenRetry\.retries" option/,
    );
});

test("resolveListenRetry rejects invalid delay", () => {
    assert.throws(
        () => resolveListenRetry({ listenRetry: { delay: -1 } }),
        /Invalid "listenRetry\.delay" option/,
    );
});
