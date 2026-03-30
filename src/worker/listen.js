/**
 * @fileoverview worker/listen.js: Listen parsing and startup retry utilities.
 */

/**
 * Parses and validates a port number.
 * @param {string|number} port - Raw port value.
 * @returns {number} Validated port in the range 0-65535.
 */
function parsePort(port) {
    const portNumber = Number(port);
    if (!Number.isInteger(portNumber) || portNumber < 0 || portNumber > 65535) {
        throw new Error(`Invalid listen port "${port}"`);
    }
    return portNumber;
}

/**
 * Determines whether a string represents a Unix socket or Windows named pipe path.
 * @param {string} value - Listen address string.
 * @returns {boolean}
 */
function isSocketPath(value) {
    return (
        value.startsWith("/") ||
        value.startsWith("./") ||
        value.startsWith("../") ||
        value.startsWith(".\\") ||
        value.startsWith("..\\") ||
        value.startsWith("\\\\") ||
        /^[A-Za-z]:[\\/]/.test(value) ||
        value.includes("/") ||
        value.includes("\\")
    );
}

/**
 * Validates and normalizes an object-form listen configuration.
 * @param {object} listen - Listen config with path or host/port properties.
 * @returns {object} Normalized listen config for Fastify.
 */
function parseListenObject(listen) {
    const hasPath = listen.path !== undefined && listen.path !== null;
    const hasPort = listen.port !== undefined && listen.port !== null;
    const hasHost = listen.host !== undefined && listen.host !== null;

    if (hasPath && (hasPort || hasHost)) {
        throw new Error(
            'Invalid listen config object: "path" cannot be combined with "host" or "port".',
        );
    }

    const listenConfig = {};

    if (hasPath) {
        if (typeof listen.path !== "string" || listen.path.trim().length === 0) {
            throw new Error("Invalid listen path. Expected a non-empty string.");
        }
        listenConfig.path = listen.path.trim();
    } else if (hasPort) {
        const host = hasHost ? String(listen.host).trim() : "127.0.0.1";
        if (host.length === 0) {
            throw new Error("Invalid listen host. Expected a non-empty string.");
        }
        listenConfig.host = host;
        listenConfig.port = parsePort(listen.port);
    } else {
        throw new Error(
            'Invalid listen config object. Expected either {"path": "..."} or {"port": number, "host"?: string}.',
        );
    }

    if (listen.backlog !== undefined) {
        if (!Number.isInteger(listen.backlog) || listen.backlog < 0) {
            throw new TypeError('Invalid "listen.backlog" option. Expected an integer >= 0.');
        }
        listenConfig.backlog = listen.backlog;
    }

    for (const key of ["readableAll", "writableAll", "ipv6Only", "exclusive"]) {
        if (listen[key] !== undefined) {
            if (typeof listen[key] !== "boolean") {
                throw new TypeError(`Invalid "listen.${key}" option. Expected a boolean.`);
            }
            listenConfig[key] = listen[key];
        }
    }

    return listenConfig;
}

export function parseListenConfig(listen) {
    if (listen && typeof listen === "object" && !Array.isArray(listen)) {
        return parseListenObject(listen);
    }

    const value = String(listen ?? 0).trim();

    if (value.length === 0) {
        return { port: 0, host: "127.0.0.1" };
    }

    if (isSocketPath(value)) {
        return { path: value };
    }

    if (/^\d+$/.test(value)) {
        return { port: parsePort(value), host: "127.0.0.1" };
    }

    const ipv6WithPort = /^\[([^\]]+)\]:(\d+)$/.exec(value);
    if (ipv6WithPort) {
        return { host: ipv6WithPort[1], port: parsePort(ipv6WithPort[2]) };
    }

    const hostPort = /^([^:]+):(\d+)$/.exec(value);
    if (hostPort) {
        return { host: hostPort[1], port: parsePort(hostPort[2]) };
    }

    if (value.includes(":")) {
        throw new Error(
            `Invalid listen address "${value}". Expected "host:port" or "[ipv6]:port" when using colons.`,
        );
    }

    throw new Error(
        `Invalid listen value "${value}". Expected "port", "host:port", "[ipv6]:port", or socket path.`,
    );
}

export function resolveListenRetry(config = {}) {
    const defaults = { retries: 5, delay: 15000 };
    const retry = config.listenRetry;

    if (retry === undefined || retry === null) {
        return defaults;
    }

    if (typeof retry !== "object" || Array.isArray(retry)) {
        throw new TypeError('Invalid "listenRetry" option. Expected an object.');
    }

    const retries = retry.retries ?? defaults.retries;
    const delay = retry.delay ?? defaults.delay;

    if (!Number.isInteger(retries) || retries < 1) {
        throw new TypeError('Invalid "listenRetry.retries" option. Expected an integer >= 1.');
    }

    if (!Number.isInteger(delay) || delay < 0) {
        throw new TypeError('Invalid "listenRetry.delay" option. Expected an integer >= 0.');
    }

    return { retries, delay };
}

/**
 * Retries an async operation with fixed delay between attempts.
 * @param {Function} operation - Async function to attempt.
 * @param {object} [options] - Retry options.
 * @param {number} [options.retries=5] - Maximum number of attempts.
 * @param {number} [options.delay=100] - Delay in milliseconds between retries.
 * @param {Function} [options.onRetry] - Callback invoked on each retry with (error, attempt, delay).
 * @returns {Promise<*>} Result of the successful operation.
 */
async function retryOperation(operation, { retries = 5, delay = 100, onRetry } = {}) {
    for (let attempt = 1; attempt <= retries; ++attempt) {
        try {
            return await operation();
        } catch (ex) {
            if (attempt >= retries) {
                throw ex;
            }
            if (onRetry) {
                onRetry(ex, attempt, delay);
            }
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }
}

/**
 * Tell Fastify to start listening with retry logic.
 */
export async function listen(fastify, retries = 5, delay = 100) {
    const config = fastify.config;
    const pkg = fastify.pkg;

    const listenConfig = parseListenConfig(config.listen);

    listenConfig.listenTextResolver = (address) =>
        `Moshi moshi ${pkg.name} v${pkg.version} in ${config.environment} mode listening on ${address}`;

    try {
        await retryOperation(() => fastify.listen(listenConfig), {
            retries,
            delay,
            onRetry: (ex, attempt, nextDelay) => {
                fastify.log.warn(
                    `Attempt ${attempt} failed: ${ex.message}. Retrying in ${nextDelay}ms...`,
                    ex,
                );
            },
        });
    } catch (ex) {
        fastify.log.error("All startup listen attempts exhausted.");
        throw ex;
    }
}
