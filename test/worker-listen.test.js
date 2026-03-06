import assert from "node:assert/strict";
import { test } from "node:test";
import { parseListenConfig } from "../src/worker.js";

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
