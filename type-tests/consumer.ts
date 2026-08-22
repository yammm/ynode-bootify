import {
    bootify,
    type BootifyConfig,
    type BootifyLifecycleContext,
    type BootifyLifecyclePhase,
    type BootifyResult,
    type BootOptions,
} from "@ynode/bootify";
import type { FastifyPluginAsync } from "fastify";

const config: BootifyConfig = {
    cluster: false,
    listen: { host: "127.0.0.1", port: 3000 },
    rewrite: { "/health": "/internal/health" },
    sleep: { sleep: 60, grace: 0, jitter: 0 },
};

const plugin: FastifyPluginAsync = async (app) => {
    const phase: BootifyLifecyclePhase = app.bootify.phase;
    const address: string | null = app.bootify.address;
    const shutdownSignal: AbortSignal = app.bootify.shutdownSignal;
    const programmaticShutdown: Promise<void> = app.bootify.shutdown("type-test");
    void phase;
    void address;
    void shutdownSignal;
    void programmaticShutdown;
    app.get("/health", async () => ({ ok: true }));
};

const options: BootOptions = {
    app: async () => plugin,
    config,
    pkg: { name: "type-consumer", version: "1.0.0" },
    hooks: {
        onBeforeListen(context: BootifyLifecycleContext) {
            context.fastify.log.info(context.pkg);
            const phase: BootifyLifecyclePhase = context.lifecycle.phase;
            const address: string | null = context.lifecycle.address;
            const shutdownSignal: AbortSignal = context.lifecycle.shutdownSignal;
            void phase;
            void address;
            void shutdownSignal;
        },
        onShutdown({ signal }) {
            const shutdownSignal: string = signal;
            void shutdownSignal;
        },
    },
};

const result: Promise<BootifyResult> = bootify(options);
void result;
