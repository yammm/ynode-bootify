import assert from "node:assert/strict";
import { test } from "node:test";

import { bootify } from "../src/plugin.js";

async function expectTypeError(fn, pattern) {
    await assert.rejects(fn, (err) => {
        assert.ok(err instanceof TypeError);
        assert.match(err.message, pattern);
        return true;
    });
}

test("bootify rejects invalid app option", async () => {
    await expectTypeError(
        () =>
            bootify({
                app: null,
                config: {},
                pkg: {},
            }),
        /Invalid "app" option/,
    );
});

test("bootify rejects invalid config option", async () => {
    await expectTypeError(
        () =>
            bootify({
                app: async () => ({}),
                config: null,
                pkg: {},
            }),
        /Invalid "config" option/,
    );
});

test("bootify rejects invalid pkg option", async () => {
    await expectTypeError(
        () =>
            bootify({
                app: async () => ({}),
                config: {},
                pkg: "nope",
            }),
        /Invalid "pkg" option/,
    );
});

test("bootify rejects invalid validator option", async () => {
    await expectTypeError(
        () =>
            bootify({
                app: async () => ({}),
                config: {},
                pkg: {},
                validator: "nope",
            }),
        /Invalid "validator" option/,
    );
});

test("bootify rejects invalid hooks option", async () => {
    await expectTypeError(
        () =>
            bootify({
                app: async () => ({}),
                config: {},
                pkg: {},
                hooks: "nope",
            }),
        /Invalid "hooks" option/,
    );
});

test("bootify rejects invalid hooks.onAfterListen option", async () => {
    await expectTypeError(
        () =>
            bootify({
                app: async () => ({}),
                config: {},
                pkg: {},
                hooks: {
                    onAfterListen: "nope",
                },
            }),
        /Invalid "hooks\.onAfterListen" option/,
    );
});
