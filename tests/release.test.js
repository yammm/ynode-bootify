import assert from "node:assert/strict";
import test from "node:test";

import { verifyChangelog, verifyReleaseIdentity } from "../scripts/verify-release.mjs";

const manifest = {
    name: "@ynode/example",
    version: "1.2.3",
    publishConfig: { access: "public" },
};

test("release identity accepts an aligned clean SemVer", () => {
    assert.doesNotThrow(() => verifyReleaseIdentity(manifest, "v1.2.3"));
    assert.doesNotThrow(() => verifyChangelog("#### [v1.2.3]\n", "v1.2.3"));
});

test("release identity rejects build metadata and mismatched artifacts", () => {
    assert.throws(
        () => verifyReleaseIdentity({ ...manifest, version: "1.2.3+build" }, "v1.2.3"),
        /clean X\.Y\.Z SemVer/u,
    );
    assert.throws(() => verifyReleaseIdentity(manifest, "v1.2.4"), /does not match/u);
    assert.throws(() => verifyChangelog("#### [v1.2.2]\n", "v1.2.3"), /does not match/u);
});
