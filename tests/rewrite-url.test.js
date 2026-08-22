import assert from "node:assert/strict";
import { test } from "node:test";

import { assertRewriteConfig, rewriteUrl } from "../src/rewrite.js";

test("rewriteUrl returns original URL when config is missing", () => {
    assert.strictEqual(rewriteUrl({ url: "/foo?a=1" }, null), "/foo?a=1");
});

test("rewriteUrl rewrites own mapped paths and preserves query string", () => {
    const result = rewriteUrl(
        { url: "/api/users?page=2&limit=10" },
        { rewrite: { "/api/users": "/v1/users" } },
    );

    assert.strictEqual(result, "/v1/users?page=2&limit=10");
});

test("rewriteUrl ignores inherited rewrite keys", () => {
    const rewrite = Object.create({ "/foo": "/bar" });
    const result = rewriteUrl({ url: "/foo?a=1" }, { rewrite });

    assert.strictEqual(result, "/foo?a=1");
});

test("rewriteUrl supports own empty-string rewrite targets", () => {
    const result = rewriteUrl({ url: "/foo?a=1" }, { rewrite: { "/foo": "" } });

    assert.strictEqual(result, "?a=1");
});

test("rewriteUrl ignores non-string rewrite targets", () => {
    const result = rewriteUrl({ url: "/foo?a=1" }, { rewrite: { "/foo": 42 } });

    assert.strictEqual(result, "/foo?a=1");
});

test("rewriteUrl merges request query into a target with its own query", () => {
    const result = rewriteUrl({ url: "/a?y=2" }, { rewrite: { "/a": "/b?x=1" } });

    assert.strictEqual(result, "/b?x=1&y=2");
});

test("rewriteUrl keeps the target query when the request has none", () => {
    const result = rewriteUrl({ url: "/a" }, { rewrite: { "/a": "/b?x=1" } });

    assert.strictEqual(result, "/b?x=1");
});

test("rewriteUrl merges duplicate query keys from target and request", () => {
    const result = rewriteUrl({ url: "/a?x=2&y=3" }, { rewrite: { "/a": "/b?x=1" } });

    assert.strictEqual(result, "/b?x=1&x=2&y=3");
});

test("assertRewriteConfig accepts missing, empty, and string-valued maps", () => {
    assert.doesNotThrow(() => assertRewriteConfig(undefined));
    assert.doesNotThrow(() => assertRewriteConfig({}));
    assert.doesNotThrow(() => assertRewriteConfig({ rewrite: {} }));
    assert.doesNotThrow(() => assertRewriteConfig({ rewrite: { "/a": "/b", "/c": "" } }));
});

test("assertRewriteConfig rejects non-object rewrite maps", () => {
    assert.throws(() => assertRewriteConfig({ rewrite: "nope" }), {
        name: "TypeError",
        message: /Invalid "config\.rewrite" option/,
    });
    assert.throws(() => assertRewriteConfig({ rewrite: ["/a"] }), {
        name: "TypeError",
        message: /Invalid "config\.rewrite" option/,
    });
});

test("assertRewriteConfig rejects non-string rewrite targets", () => {
    assert.throws(() => assertRewriteConfig({ rewrite: { "/a": 42 } }), {
        name: "TypeError",
        message: /Invalid "config\.rewrite" target for "\/a"/,
    });
});
