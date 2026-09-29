import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import type { FastifyInstance } from "fastify";

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
}
