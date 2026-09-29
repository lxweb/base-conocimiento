import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { startApp } from "../src/app.ts";

export async function startTestApp(): Promise<FastifyInstance> {
  process.env.AUTH_PASSWORD = "secreta";
  const databaseUrl = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/conocimiento";
  const mediaDir = mkdtempSync(join(tmpdir(), "medios-"));
  return startApp({ databaseUrl, mediaDir });
}

export async function login(app: FastifyInstance): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { password: "secreta" },
  });
  return response.json().token as string;
}
