/**
 * Type definitions for @ynode/bootify
 */

import { FastifyInstance, FastifyPluginAsync } from "fastify";

type AppModule = { default: FastifyPluginAsync };
type AppPlugin = FastifyPluginAsync | AppModule;

export interface ListenOptions {
    host?: string;
    port?: number;
    path?: string;
    backlog?: number;
    readableAll?: boolean;
    writableAll?: boolean;
    ipv6Only?: boolean;
    exclusive?: boolean;
}

export interface ListenRetryOptions {
    retries?: number;
    delay?: number;
}

export interface BootifyConfig extends Record<string, any> {
    cluster?: boolean | Record<string, any>;
    pidfile?: string;
    http2?: boolean;
    rewrite?: Record<string, string>;
    sleep?: number | Record<string, any>;
    listen?: string | ListenOptions;
    listenRetry?: ListenRetryOptions;
}

export interface BootifyLifecycleContext {
    fastify: FastifyInstance;
    config: BootifyConfig;
    pkg: Record<string, any>;
}

export interface BootifyHooks {
    onBeforeListen?: (context: BootifyLifecycleContext) => Promise<void> | void;
    onAfterListen?: (
        context: BootifyLifecycleContext & { address: string },
    ) => Promise<void> | void;
    onShutdown?: (context: BootifyLifecycleContext & { signal: string }) => Promise<void> | void;
}

export interface BootOptions {
    /**
     * A function that imports and returns the application entry point.
     * The module must export the Fastify plugin as `default`.
     */
    app: (fastify: FastifyInstance, config: BootifyConfig) => Promise<AppPlugin> | AppPlugin;

    /**
     * The configuration object (typically parsed argv).
     */
    config: BootifyConfig;

    /**
     * The package.json content.
     */
    pkg?: Record<string, any>;

    /**
     * Optional validation function for configuration.
     */
    validator?: (config: BootifyConfig) => Promise<void> | void;

    /**
     * Optional lifecycle hooks that run around listen/shutdown.
     */
    hooks?: BootifyHooks;
}

/**
 * Initializes the application bootstrap process.
 * Handles clustering, signal traps, and starting the Fastify server.
 */
export function bootify(options: BootOptions): Promise<any>;
