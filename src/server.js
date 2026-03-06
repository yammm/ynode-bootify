/**
 *  server.js: The Server Factory
 *
 * @module server
 *
 * Its single responsibility is to build and configure the Fastify server instance.
 * It acts like a factory that assembles the server with all its plugins and routes
 * and then hands off the finished product. It should not be responsible for running
 * the server or binding it to a port. This makes your server definition reusable
 * and much easier to test, as you can import createServer in a test file without
 * causing side effects like listening on a port.
 */

import cluster from "node:cluster";

import Fastify from "fastify";

import autoshutdown from "@ynode/autoshutdown";
import proxiable from "proxiable";
import { rewriteUrl } from "./rewrite.js";

/**
 * Creates and configures a Fastify server instance.
 * @param {object} config - The configuration object from yargs.
 * @param {object} log - The logger instance.
 * @returns {Promise<Fastify.FastifyInstance>} A configured Fastify instance.
 */
export async function createServer(config, log) {
    const fastify = Fastify({
        loggerInstance: log,
        trustProxy: config.trustProxy ?? false,
        http2: !!config.http2,
        disableRequestLogging: true,
        rewriteUrl: (req) => rewriteUrl(req, config),
    });

    // register plugins
    if (cluster.isWorker) {
        fastify.register(autoshutdown, { sleep: config.sleep, reportLoad: true });
    }

    // use proxiable to handle common issues with unix domain sockets
    proxiable(fastify.server);

    return fastify;
}
