/**
 * @fileoverview rewrite.js: URL Rewrite Manager.
 *
 * Simple URL rewrite module.
 */

/**
 * Validates the rewrite map at the configuration boundary.
 * Ensures every rewrite target is a string before requests reach rewriteUrl().
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
        if (typeof target !== "string") {
            throw new TypeError(
                `Invalid "config.rewrite" target for "${path}". Expected a string.`,
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

    if (!Object.hasOwn(rewrite, pathname) || typeof rewrite[pathname] !== "string") {
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
