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

export interface BootifyClusterTtyOptions {
    enabled?: boolean;
    commands?: boolean;
    reloadCommand?: string;
    stdin?: NodeJS.ReadStream;
    stdout?: NodeJS.WriteStream;
    prompt?: string;
}

export interface BootifyClusterOptions extends Record<string, any> {
    enabled?: boolean;
    tty?: BootifyClusterTtyOptions;
}

export interface BootifyConfig extends Record<string, any> {
    cluster?: boolean | BootifyClusterOptions;
    pidfile?: string;
    http2?: boolean;
    trustProxy?: boolean | string | number | Record<string, any>;
    rewrite?: Record<string, string>;
    sleep?: number | Record<string, any>;
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

export interface BootifyClusterMetrics {
    workers: Array<Record<string, any>>;
    totalLag: number;
    avgLag: number;
    workerCount: number;
    maxWorkers: number;
    minWorkers: number;
    scaleUpThreshold: number;
    scaleDownThreshold: number;
    mode: "smart" | "max";
}

export type BootifyClusterEventName =
    | "worker_online"
    | "worker_exit"
    | "worker_restart_scheduled"
    | "worker_listening"
    | "scale_up"
    | "scale_down"
    | "reload_start"
    | "reload_end"
    | "reload_fail"
    | "shutdown_start"
    | "shutdown_end";

export interface BootifyClusterEvent {
    type: BootifyClusterEventName;
    [key: string]: unknown;
}

export interface BootifyManager {
    getMetrics: () => BootifyClusterMetrics;
    reload: () => Promise<void>;
    close: () => Promise<void>;
    on: (
        eventName: BootifyClusterEventName,
        listener: (event: BootifyClusterEvent) => void,
    ) => BootifyManager;
    once: (
        eventName: BootifyClusterEventName,
        listener: (event: BootifyClusterEvent) => void,
    ) => BootifyManager;
    off: (
        eventName: BootifyClusterEventName,
        listener: (event: BootifyClusterEvent) => void,
    ) => BootifyManager;
}

export type BootifyResult = void | BootifyManager;

/**
 * Initializes the application bootstrap process.
 * Handles clustering, signal traps, and starting the Fastify server.
 */
export function bootify(options: BootOptions): Promise<BootifyResult>;
