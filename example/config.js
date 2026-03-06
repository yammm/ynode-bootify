/**
 * Example Configuration
 *
 * Demonstrates a robust configuration setup using yargs.
 * Defines standard options for clustering, listening, and environment.
 */

import yargs from "yargs";
import { hideBin } from "yargs/helpers";

export default yargs(hideBin(process.argv))
    .env("MY_APP") // Load env vars prefixed with MY_APP_
    .option("listen", {
        alias: "l",
        describe: "Address/Port or Socket path to listen on",
        type: "string",
        default: "3000",
    })
    .option("environment", {
        alias: "e",
        describe: "Application environment",
        type: "string",
        default: "development",
        choices: ["development", "production", "test"],
    })
    .option("cluster", {
        describe: "Cluster configuration (boolean or JSON)",
        default: false,
        coerce: (arg) => {
            if (arg === "true") {
                return true;
            }
            if (arg === "false") {
                return false;
            }
            try {
                return JSON.parse(arg);
            } catch {
                return arg; // return as string or boolean
            }
        },
    })
    .option("pidfile", {
        describe: "Path to write PID file",
        type: "string",
    })
    .option("sleep", {
        describe: "Shutdown sleep duration in ms",
        type: "number",
        default: 5000,
    })
    .option("listenRetry", {
        describe: 'Listen retry policy as JSON (e.g. \'{"retries":3,"delay":1000}\')',
        default: { retries: 5, delay: 15000 },
        coerce: (arg) => {
            if (typeof arg === "object" && arg !== null) {
                return arg;
            }
            try {
                return JSON.parse(arg);
            } catch {
                return arg;
            }
        },
    })
    .option("verbose", {
        alias: "v",
        describe: "Enable verbose logging",
        type: "boolean",
        default: false,
    })
    .help()
    .parse();
