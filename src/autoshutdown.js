/**
 * @fileoverview autoshutdown.js: Idle-only Autoshutdown option boundary.
 *
 * Bootify owns the boundary between Autoshutdown and Cluster: only idle
 * shutdown settings pass through, while Cluster keeps ownership of worker
 * heartbeat, memory retirement, and process lifecycle settings.
 */

const IDLE_OPTION_NAMES = new Set([
    "sleep",
    "grace",
    "ignoreUrls",
    "ignore",
    "jitter",
    "force",
    "hookTimeout",
    "closeTimeout",
    "onShutdownStart",
    "onShutdownComplete",
]);

const MAX_TIMER_MS = 2 ** 31 - 1;
const IDLE_DEFAULTS = Object.freeze({ sleep: 30 * 60, jitter: 5 });

const CLUSTER_OWNED_OPTION_NAMES = new Set([
    "exitProcess",
    "reportLoad",
    "heartbeatInterval",
    "memoryLimit",
]);

function assertClusterOwnedOption(name, value) {
    const safeValue =
        (name === "exitProcess" && value === true) ||
        (name === "reportLoad" && value === false) ||
        (name === "memoryLimit" && value === 0);
    if (safeValue) {
        return;
    }

    throw new TypeError(
        `Invalid "config.sleep.${name}" option. @ynode/cluster owns worker heartbeat, memory retirement, and process lifecycle settings.`,
    );
}

/**
 * Validates Bootify's complete worker autoshutdown boundary before any worker
 * is forked. This is the single validation path used by both the primary and
 * worker server factory.
 * @param {object} options - Normalized worker autoshutdown options.
 * @returns {void}
 */
export function validateAutoshutdownOptions(options) {
    const numericOptions = [
        ["sleep", options.sleep, false],
        ["grace", options.grace, true],
        ["jitter", options.jitter, true],
        ["hookTimeout", options.hookTimeout, true],
        ["closeTimeout", options.closeTimeout, false],
    ];
    for (const [name, value, allowZero] of numericOptions) {
        if (value === undefined) {
            continue;
        }
        if (!Number.isFinite(value) || (allowZero ? value < 0 : value <= 0)) {
            throw new TypeError(
                `Invalid "config.sleep.${name}" option. Expected a ${allowZero ? "non-negative" : "positive"} finite number.`,
            );
        }
    }

    if (options.ignoreUrls !== undefined) {
        if (!Array.isArray(options.ignoreUrls)) {
            throw new TypeError(
                'Invalid "config.sleep.ignoreUrls" option. Expected an array of strings or RegExp objects.',
            );
        }
        if (
            options.ignoreUrls.some(
                (pattern) => typeof pattern !== "string" && !(pattern instanceof RegExp),
            )
        ) {
            throw new TypeError(
                'Invalid "config.sleep.ignoreUrls" option. Expected only strings or RegExp objects.',
            );
        }
    }
    if (
        options.ignore !== undefined &&
        options.ignore !== null &&
        typeof options.ignore !== "function"
    ) {
        throw new TypeError('Invalid "config.sleep.ignore" option. Expected a function.');
    }
    if (options.force !== undefined && typeof options.force !== "boolean") {
        throw new TypeError('Invalid "config.sleep.force" option. Expected a boolean.');
    }
    for (const name of ["onShutdownStart", "onShutdownCommit", "onShutdownComplete"]) {
        const value = options[name];
        if (value !== undefined && value !== null && typeof value !== "function") {
            throw new TypeError(`Invalid "config.sleep.${name}" option. Expected a function.`);
        }
    }

    for (const [name, multiplier] of [
        ["grace", 1000],
        ["hookTimeout", 1],
        ["closeTimeout", 1],
    ]) {
        if (options[name] !== undefined && options[name] * multiplier > MAX_TIMER_MS) {
            throw new TypeError(
                `Invalid "config.sleep.${name}" option. Value exceeds Node.js timer limits.`,
            );
        }
    }
    const sleep = options.sleep ?? IDLE_DEFAULTS.sleep;
    const jitter = options.jitter ?? IDLE_DEFAULTS.jitter;
    if ((sleep + jitter) * 1000 > MAX_TIMER_MS) {
        throw new TypeError(
            'Invalid "config.sleep" options. Combined sleep and jitter exceed Node.js timer limits.',
        );
    }
}

/**
 * Builds the idle-only autoshutdown options used by Bootify cluster workers.
 * Cluster owns worker heartbeat, memory retirement, and replacement behavior.
 * @param {object} [config={}] - Bootify configuration.
 * @returns {object} Normalized autoshutdown options.
 */
export function buildAutoshutdownOptions(config = {}) {
    const configured = config.sleep;
    const idleOptions = {};

    if (configured !== undefined) {
        if (typeof configured === "number") {
            if (!Number.isFinite(configured) || configured <= 0) {
                throw new TypeError(
                    'Invalid "config.sleep" option. Expected a positive inactivity period.',
                );
            }
            idleOptions.sleep = configured;
        } else if (
            configured !== null &&
            typeof configured === "object" &&
            !Array.isArray(configured)
        ) {
            for (const [name, value] of Object.entries(configured)) {
                if (value === undefined) {
                    continue;
                }
                if (IDLE_OPTION_NAMES.has(name)) {
                    idleOptions[name] = value;
                    continue;
                }
                if (CLUSTER_OWNED_OPTION_NAMES.has(name)) {
                    assertClusterOwnedOption(name, value);
                    continue;
                }
                throw new TypeError(`Invalid "config.sleep.${name}" option. Unsupported option.`);
            }
        } else {
            throw new TypeError(
                'Invalid "config.sleep" option. Expected an inactivity period or idle-shutdown options object.',
            );
        }
    }

    const options = {
        ...idleOptions,
        exitProcess: true,
        reportLoad: false,
        memoryLimit: 0,
    };
    validateAutoshutdownOptions(options);
    return options;
}
