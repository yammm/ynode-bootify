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

    return {
        ...idleOptions,
        exitProcess: true,
        reportLoad: false,
        memoryLimit: 0,
    };
}
