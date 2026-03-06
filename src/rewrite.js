/**
 * @fileoverview rewrite.js: URL Rewrite Manager.
 *
 * Simple URL rewrite module.
 */

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
    const queryString = queryParts.length > 0 ? "?" + queryParts.join("?") : "";

    if (Object.hasOwn(rewrite, pathname) && typeof rewrite[pathname] === "string") {
        return rewrite[pathname] + queryString;
    }

    return req.url;
}
