import assert from "node:assert/strict";
import { test } from "node:test";
import { rewriteUrl } from "../src/rewrite.js";

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
