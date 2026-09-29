import type { Pool } from "./db.ts";

declare module "fastify" {
  interface FastifyInstance {
    pool: Pool;
    mediaDir: string;
  }
}
