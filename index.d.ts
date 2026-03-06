/**
 * Type definitions for @ynode/bootify
 */

import { FastifyInstance, FastifyPluginAsync } from "fastify";

type AppModule = { default: FastifyPluginAsync };
type AppPlugin = FastifyPluginAsync | AppModule;

export interface BootOptions {
    /**
     * A function that imports and returns the application entry point.
     * The module must export the Fastify plugin as `default`.
     */
    app: (fastify: FastifyInstance, config: Record<string, any>) => Promise<AppPlugin> | AppPlugin;

    /**
     * The configuration object (typically parsed argv).
     */
    config: Record<string, any>;

    /**
     * The package.json content.
     */
    pkg?: Record<string, any>;

    /**
     * Optional validation function for configuration.
     */
    validator?: (config: Record<string, any>) => Promise<void> | void;
}

/**
 * Initializes the application bootstrap process.
 * Handles clustering, signal traps, and starting the Fastify server.
 */
export function bootify(options: BootOptions): Promise<any>;
