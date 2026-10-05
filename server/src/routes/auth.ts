import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function registerAuth(app: FastifyInstance): void {
  app.post("/auth/login", async (request, reply) => {
    const body = request.body as { password?: string };
    const expected = process.env.AUTH_PASSWORD ?? "";
    const given = body.password ?? "";
    const a = Buffer.from(expected);
    const b = Buffer.from(given);
    const same = a.length === b.length && timingSafeEqual(a, b);
    if (!same) return reply.code(401).send({ error: "credenciales" });
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await app.pool.query("INSERT INTO tokens (token_hash, expires_at) VALUES ($1, $2)", [
      hashToken(token),
      expiresAt.toISOString(),
    ]);
    return { token, expiresAt: expiresAt.toISOString() };
  });

  app.addHook("onRequest", async (request, reply) => {
    const path = request.url.split("?")[0];
    if (path === "/auth/login" || path === "/health") return;
    if (path === "/" || path === "/index.html" || path.startsWith("/assets/")) return;
    const header = request.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) return reply.code(401).send({ error: "token" });
    const found = await app.pool.query(
      "SELECT expires_at FROM tokens WHERE token_hash = $1",
      [hashToken(token)],
    );
    const row = found.rows[0] as { expires_at: Date } | undefined;
    if (!row || new Date(row.expires_at).getTime() <= Date.now()) return reply.code(401).send({ error: "token" });
  });
}
