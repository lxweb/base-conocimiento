import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import type { FastifyInstance } from "fastify";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
};

function contentType(kind: string, storedName: string): string {
  const byExt = MIME[extname(storedName).toLowerCase()];
  if (byExt) return byExt;
  return kind === "video" ? "video/mp4" : "image/png";
}

const LIMITS: Record<string, number> = {
  image: 10 * 1024 * 1024,
  video: 100 * 1024 * 1024,
};

function ensureOctetStreamParser(app: FastifyInstance): void {
  if (app.hasContentTypeParser("application/octet-stream")) return;
  app.addContentTypeParser("application/octet-stream", { parseAs: "buffer" }, (_request, body, done) => {
    done(null, body);
  });
}

export function registerMedia(app: FastifyInstance): void {
  ensureOctetStreamParser(app);

  app.post(
    "/conocimientos/:id/medios",
    { bodyLimit: 100 * 1024 * 1024 },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const kind = request.headers["x-kind"];
      const filename = request.headers["x-filename"];
      if (kind !== "image" && kind !== "video") return reply.code(400).send({ error: "kind" });
      if (typeof filename !== "string" || filename.length === 0) return reply.code(400).send({ error: "filename" });
      const body = request.body as Buffer;
      if (body.length > LIMITS[kind]) return reply.code(413).send({ error: "tamano" });
      const storedName = `${randomUUID()}-${basename(filename)}`;
      await writeFile(join(app.mediaDir, storedName), body);
      const mediaId = randomUUID();
      await app.pool.query(
        "INSERT INTO medios (id, conocimiento_id, kind, stored_name, bytes) VALUES ($1, $2, $3, $4, $5)",
        [mediaId, id, kind, storedName, body.length],
      );
      return reply.code(201).send({ id: mediaId, kind });
    },
  );

  app.get("/medios/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const found = await app.pool.query<{ kind: string; stored_name: string }>(
      "SELECT kind, stored_name FROM medios WHERE id = $1",
      [id],
    );
    const row = found.rows[0];
    if (!row) return reply.code(404).send({ error: "medio" });
    const bytes = await readFile(join(app.mediaDir, row.stored_name));
    return reply.type(contentType(row.kind, row.stored_name)).send(bytes);
  });
}
