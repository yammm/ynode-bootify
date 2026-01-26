/**
 * Example Application Plugin
 * @param {import('fastify').FastifyInstance} fastify
 */
export default async function app(fastify) {
    fastify.get("/", async () => {
        return {
            hello: "world",
            environment: fastify.config.environment,
            pid: process.pid,
        };
    });
}
