/**
 *  rewrite.js: URL Rewrite Manager
 *
 * @module rewrite
 *
 * Simple URL rewrite module
 */

/**
 * Manages the application"s rewriteing.
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

    const url = rewrite[req.url];
    if (url) {
        return url;
    }

    return req.url;
}
