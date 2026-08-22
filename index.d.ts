/**
 * Type definitions for @ynode/bootify
 */

import type { AutoshutdownOptions } from "@ynode/autoshutdown";
import type {
    ClusterEvent,
    ClusterEventName,
    ClusterManager,
    ClusterMetrics,
    ClusterOptions,
    ClusterTtyOptions,
} from "@ynode/cluster";
import type { FastifyInstance, FastifyPluginAsync, FastifyPluginCallback } from "fastify";

type FastifyAppPlugin = FastifyPluginAsync | FastifyPluginCallback;
type AppModule = { default: FastifyAppPlugin };
type AppPlugin = FastifyAppPlugin | AppModule;

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

export interface BootifyClusterTtyOptions extends ClusterTtyOptions {}

export interface BootifyClusterOptions extends ClusterOptions {}

export interface BootifyAutoshutdownOptions {
    sleep?: AutoshutdownOptions["sleep"];
    grace?: AutoshutdownOptions["grace"];
    ignoreUrls?: AutoshutdownOptions["ignoreUrls"];
    ignore?: AutoshutdownOptions["ignore"];
    jitter?: AutoshutdownOptions["jitter"];
    force?: AutoshutdownOptions["force"];
    hookTimeout?: AutoshutdownOptions["hookTimeout"];
    closeTimeout?: number;
    onShutdownStart?: AutoshutdownOptions["onShutdownStart"];
    onShutdownComplete?: AutoshutdownOptions["onShutdownComplete"];
}

export interface BootifyConfig extends Record<string, any> {
    cluster?: boolean | BootifyClusterOptions;
    environment?: string;
    pidfile?: string;
    http2?: boolean;
    trustProxy?: boolean | string | number | Record<string, any>;
    rewrite?: Record<string, string>;
    sleep?: number | BootifyAutoshutdownOptions;
    listen?: string | number | ListenOptions;
    listenRetry?: ListenRetryOptions;
}

export interface BootifyLifecycleContext {
    fastify: FastifyInstance;
    config: BootifyConfig;
    pkg: Record<string, any>;
}

export interface BootifyAfterListenContext extends BootifyLifecycleContext {
    address: string;
}

export interface BootifyShutdownContext extends BootifyLifecycleContext {
    signal: string;
}

export interface BootifyHooks {
    onBeforeListen?: (context: BootifyLifecycleContext) => Promise<void> | void;
    onAfterListen?: (context: BootifyAfterListenContext) => Promise<void> | void;
    onShutdown?: (context: BootifyShutdownContext) => Promise<void> | void;
}

export interface BootOptions {
    /**
     * A function that imports and returns the application entry point.
     * Accepts a bare Fastify plugin or a module that exports one as `default`.
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
     * Backward-compatible top-level Cluster TTY configuration. Prefer config.cluster.tty.
     */
    tty?: BootifyClusterTtyOptions;

    /**
     * Optional validation function for configuration.
     */
    validator?: (config: BootifyConfig) => Promise<void> | void;

    /**
     * Optional lifecycle hooks that run around listen/shutdown.
     */
    hooks?: BootifyHooks;
}

export type BootifyClusterMetrics = ClusterMetrics;
export type BootifyClusterEventName = ClusterEventName;
export type BootifyClusterEvent = ClusterEvent;
export type BootifyManager = ClusterManager;

declare module "fastify" {
    interface FastifyInstance {
        config: BootifyConfig;
        pkg: Record<string, any>;
        clusterCount: number;
        clusterMinWorkers: number;
        clusterMaxWorkers: number;
        clusterMode: "smart" | "max";
    }
}

export type BootifyResult = void | BootifyManager;

/**
 * Initializes the application bootstrap process.
 * Handles clustering, signal traps, and starting the Fastify server.
 */
export function bootify(options: BootOptions): Promise<BootifyResult>;
