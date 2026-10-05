import { join } from "node:path";
import { fileURLToPath } from "node:url";
import fastifyStatic from "@fastify/static";
import type { FastifyInstance } from "fastify";

const webRoot = join(fileURLToPath(new URL(".", import.meta.url)), "../../../web/dist");

export async function registerWeb(app: FastifyInstance): Promise<void> {
  await app.register(fastifyStatic, {
    root: webRoot,
    prefix: "/",
    wildcard: false,
    index: false,
  });

  app.get("/", async (_request, reply) => reply.sendFile("index.html", webRoot));
}
