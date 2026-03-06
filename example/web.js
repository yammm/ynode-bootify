#!/usr/bin/env node

/**
 *  web.js: The Application Bootstrapper
 *
 * @module web
 *
 * This file is the entry point. It loads the configuration and initializes the
 * cluster manager. The actual application logic runs in the worker process.
 *
 * Demonstrates how to use @ynode/bootify with a robust configuration.
 */

import { bootify } from "../src/index.js";
import argv from "./config.js";
import pkg from "../package.json" with { type: "json" };

bootify({
    config: argv,
    pkg,
    app: () => import("./app.js"),
    validator: async (config) => {
        // Example validator: ensure environment is valid
        const validEnvs = ["development", "production", "test"];
        if (!validEnvs.includes(config.environment)) {
            throw new Error(`Invalid environment: ${config.environment}`);
        }
    },
});
