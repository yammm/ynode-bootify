/**
 * @fileoverview rewrite.js: URL Rewrite Manager.
 *
 * Simple URL rewrite module.
 */

/*
The MIT License (MIT)

Copyright (c) 2026 Michael Welter <me@mikinho.com>

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

/**
 * Tests whether a rewrite target is a usable internal absolute path.
 * @param {*} target - Candidate target.
 * @returns {boolean}
 */
function isUsableRewriteTarget(target) {
    return (
        typeof target === "string" &&
        target.startsWith("/") &&
        !target.startsWith("//") &&
        !/[\s#]/u.test(target)
    );
}

/**
 * Validates the rewrite map at the configuration boundary.
 * Ensures every rewrite target is a usable internal absolute path before
 * requests reach rewriteUrl().
 * @param {object} [config] - The configuration object.
 * @returns {void}
 */
export function assertRewriteConfig(config) {
    const rewrite = config?.rewrite;
    if (rewrite === undefined || rewrite === null) {
        return;
    }

    if (typeof rewrite !== "object" || Array.isArray(rewrite)) {
        throw new TypeError(
            'Invalid "config.rewrite" option. Expected an object map of paths to strings.',
        );
    }

    for (const [path, target] of Object.entries(rewrite)) {
        if (!isUsableRewriteTarget(target)) {
            throw new TypeError(
                `Invalid "config.rewrite" target for "${path}". Expected a non-empty absolute internal path without whitespace or a fragment.`,
            );
        }
    }
}

/**
 * Manages the application's rewriting.
 * @param {object} req The raw Node.js HTTP request, not the `FastifyRequest` object.
 * @param {object} config - The configuration object.
 * @returns {string} The path that the request should be mapped to.
 */
export function rewriteUrl(req, config) {
    if (!config) {
        return req.url;
    }

    const rewrite = config.rewrite;
    if (!rewrite) {
        return req.url;
    }

    const [pathname, ...queryParts] = req.url.split("?");
    const requestQuery = queryParts.join("?");

    if (!Object.hasOwn(rewrite, pathname) || !isUsableRewriteTarget(rewrite[pathname])) {
        return req.url;
    }

    const target = rewrite[pathname];
    if (requestQuery.length === 0) {
        return target;
    }

    const targetQueryIndex = target.indexOf("?");
    if (targetQueryIndex === -1) {
        return `${target}?${requestQuery}`;
    }

    // Merge the target's own query string with the request's query string
    // instead of producing a malformed second "?" separator.
    const merged = new URLSearchParams(target.slice(targetQueryIndex + 1));
    for (const [name, value] of new URLSearchParams(requestQuery)) {
        merged.append(name, value);
    }
    return `${target.slice(0, targetQueryIndex)}?${merged.toString()}`;
}
