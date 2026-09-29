import Fastify from "fastify";
import { createPool, migrate, type Pool } from "./db.ts";
import "./types.ts";
import { registerAuth } from "./routes/auth.ts";
import { registerContent } from "./routes/content.ts";
import { registerMedia } from "./routes/media.ts";
import { registerSessions } from "./routes/sessions.ts";

export type BuildAppOptions = {
  databaseUrl: string;
  mediaDir: string;
};

export function buildApp(options: BuildAppOptions): { app: Fastify.FastifyInstance; pool: Pool } {
  if (!process.env.AUTH_PASSWORD) {
    throw new Error("AUTH_PASSWORD is required");
  }

  const pool = createPool(options.databaseUrl);
  const app = Fastify();

  app.decorate("pool", pool);
  app.decorate("mediaDir", options.mediaDir);

  app.addHook("onClose", async () => {
    await pool.end();
  });

  registerAuth(app);
  registerContent(app);
  registerMedia(app);
  registerSessions(app);

  return { app, pool };
}

export async function startApp(options: BuildAppOptions): Promise<Fastify.FastifyInstance> {
  const { app, pool } = buildApp(options);
  await migrate(pool);
  return app;
}
