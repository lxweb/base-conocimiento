import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";

type OptionInput = { text: string; kind: string };
type QuestionInput = {
  type: string;
  prompt: string;
  correct?: boolean;
  expectedAnswer?: string;
  options?: OptionInput[];
};

async function nextPosition(app: FastifyInstance, sql: string, params: string[]): Promise<number> {
  const result = await app.pool.query(sql, params);
  return result.rows[0].position as number;
}

function oneComplete(options: OptionInput[] | undefined): boolean {
  return (options ?? []).filter((option) => option.kind === "completa").length === 1;
}

async function insertOptions(app: FastifyInstance, preguntaId: string, options: OptionInput[]): Promise<void> {
  for (const [index, option] of options.entries()) {
    await app.pool.query(
      "INSERT INTO opciones (id, pregunta_id, text, kind, position) VALUES ($1, $2, $3, $4, $5)",
      [randomUUID(), preguntaId, option.text, option.kind, index + 1],
    );
  }
}

export function registerContent(app: FastifyInstance): void {
  app.get("/materias", async () => {
    const materias = await app.pool.query("SELECT id, name, position FROM materias ORDER BY position");
    const ramas = await app.pool.query("SELECT id, materia_id, name, position FROM ramas ORDER BY position");
    const temas = await app.pool.query("SELECT id, rama_id, name, position, priority, points FROM temas ORDER BY position");
    const conocimientos = await app.pool.query(
      `SELECT id, tema_id, title, explanation, example, link, position, archived_at IS NOT NULL AS archived
       FROM conocimientos ORDER BY position`,
    );
    const preguntas = await app.pool.query(
      "SELECT id, conocimiento_id, type, prompt, correct, expected_answer, last_asked_on FROM preguntas",
    );
    const opciones = await app.pool.query("SELECT id, pregunta_id, text, kind, position FROM opciones ORDER BY position");
    const relaciones = await app.pool.query("SELECT id, from_id, to_id, type FROM relaciones");
    const medios = await app.pool.query("SELECT id, conocimiento_id, kind FROM medios");
    return materias.rows.map((materia) => ({
      ...materia,
      ramas: ramas.rows
        .filter((rama) => rama.materia_id === materia.id)
        .map((rama) => ({
          ...rama,
          temas: temas.rows
            .filter((tema) => tema.rama_id === rama.id)
            .map((tema) => ({
              ...tema,
              conocimientos: conocimientos.rows
                .filter((item) => item.tema_id === tema.id)
                .map((item) => ({
                  ...item,
                  preguntas: preguntas.rows
                    .filter((pregunta) => pregunta.conocimiento_id === item.id)
                    .map((pregunta) => ({
                      ...pregunta,
                      options: opciones.rows.filter((option) => option.pregunta_id === pregunta.id),
                    })),
                  relaciones: relaciones.rows.filter((relacion) => relacion.from_id === item.id),
                  medios: medios.rows.filter((medio) => medio.conocimiento_id === item.id),
                })),
            })),
        })),
    }));
  });

  app.get("/temas/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await app.pool.query("SELECT id, name, priority, points FROM temas WHERE id = $1", [id]);
    if (!result.rows[0]) return reply.code(404).send({ error: "tema" });
    return result.rows[0];
  });

  app.post("/materias", async (request, reply) => {
    const body = request.body as { name: string };
    const id = randomUUID();
    const position = await nextPosition(app, "SELECT coalesce(max(position), 0) + 1 AS position FROM materias", []);
    await app.pool.query("INSERT INTO materias (id, name, position) VALUES ($1, $2, $3)", [id, body.name, position]);
    return reply.code(201).send({ id, name: body.name, position });
  });

  app.post("/materias/:id/ramas", async (request, reply) => {
    const { id: materiaId } = request.params as { id: string };
    const body = request.body as { name: string };
    const id = randomUUID();
    const position = await nextPosition(
      app,
      "SELECT coalesce(max(position), 0) + 1 AS position FROM ramas WHERE materia_id = $1",
      [materiaId],
    );
    await app.pool.query("INSERT INTO ramas (id, materia_id, name, position) VALUES ($1, $2, $3, $4)", [
      id,
      materiaId,
      body.name,
      position,
    ]);
    return reply.code(201).send({ id, name: body.name, position });
  });

  app.post("/ramas/:id/temas", async (request, reply) => {
    const { id: ramaId } = request.params as { id: string };
    const body = request.body as { name: string; priority: string };
    const id = randomUUID();
    const position = await nextPosition(
      app,
      "SELECT coalesce(max(position), 0) + 1 AS position FROM temas WHERE rama_id = $1",
      [ramaId],
    );
    await app.pool.query(
      "INSERT INTO temas (id, rama_id, name, position, priority) VALUES ($1, $2, $3, $4, $5)",
      [id, ramaId, body.name, position, body.priority],
    );
    return reply.code(201).send({ id, name: body.name, priority: body.priority, position });
  });

  app.patch("/temas/:id", async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as { name?: string; priority?: string };
    const current = await app.pool.query("SELECT name, priority FROM temas WHERE id = $1", [id]);
    const name = body.name ?? current.rows[0].name;
    const priority = body.priority ?? current.rows[0].priority;
    await app.pool.query("UPDATE temas SET name = $2, priority = $3 WHERE id = $1", [id, name, priority]);
    return { id, name, priority };
  });

  app.post("/temas/:id/conocimientos", async (request, reply) => {
    const { id: temaId } = request.params as { id: string };
    const body = request.body as { title: string; explanation: string; example?: string; link?: string };
    const id = randomUUID();
    const position = await nextPosition(
      app,
      "SELECT coalesce(max(position), 0) + 1 AS position FROM conocimientos WHERE tema_id = $1",
      [temaId],
    );
    await app.pool.query(
      `INSERT INTO conocimientos
        (id, tema_id, title, explanation, example, link, position, consecutive_full_successes, base_interval_days, due_on)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 0, NULL)`,
      [id, temaId, body.title, body.explanation, body.example ?? null, body.link ?? null, position],
    );
    return reply.code(201).send({ id });
  });

  app.patch("/conocimientos/:id", async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as { title?: string; explanation?: string; example?: string | null; link?: string | null };
    const current = await app.pool.query("SELECT title, explanation, example, link FROM conocimientos WHERE id = $1", [id]);
    const row = current.rows[0];
    await app.pool.query(
      "UPDATE conocimientos SET title = $2, explanation = $3, example = $4, link = $5 WHERE id = $1",
      [id, body.title ?? row.title, body.explanation ?? row.explanation, body.example === undefined ? row.example : body.example, body.link === undefined ? row.link : body.link],
    );
    return { id };
  });

  app.post("/conocimientos/:id/archive", async (request) => {
    const { id } = request.params as { id: string };
    await app.pool.query("UPDATE conocimientos SET archived_at = now() WHERE id = $1", [id]);
    return { id, archived: true };
  });

  app.post("/conocimientos/:id/restore", async (request) => {
    const { id } = request.params as { id: string };
    await app.pool.query("UPDATE conocimientos SET archived_at = NULL WHERE id = $1", [id]);
    return { id, archived: false };
  });

  app.post("/reorder", async (request, reply) => {
    const body = request.body as { kind: string; parentId: string | null; orderedIds: string[] };
    const tables: Record<string, string> = {
      materia: "materias",
      rama: "ramas",
      tema: "temas",
      conocimiento: "conocimientos",
    };
    const parents: Record<string, string> = { rama: "materia_id", tema: "rama_id", conocimiento: "tema_id" };
    const table = tables[body.kind];
    if (!table) return reply.code(400).send({ error: "kind" });
    for (const [index, id] of body.orderedIds.entries()) {
      if (body.kind === "materia") {
        await app.pool.query(`UPDATE ${table} SET position = $2 WHERE id = $1`, [id, index + 1]);
      } else {
        await app.pool.query(`UPDATE ${table} SET position = $2 WHERE id = $1 AND ${parents[body.kind]} = $3`, [
          id,
          index + 1,
          body.parentId,
        ]);
      }
    }
    return { ok: true };
  });

  app.put("/relaciones", async (request, reply) => {
    const body = request.body as { fromId: string; toId: string; type: string };
    if (body.fromId === body.toId) return reply.code(400).send({ error: "misma_ficha" });
    const id = randomUUID();
    const saved = await app.pool.query(
      `INSERT INTO relaciones (id, from_id, to_id, type) VALUES ($1, $2, $3, $4)
       ON CONFLICT (from_id, to_id) DO UPDATE SET type = excluded.type
       RETURNING id, from_id, to_id, type`,
      [id, body.fromId, body.toId, body.type],
    );
    return saved.rows[0];
  });

  app.post("/conocimientos/:id/preguntas", async (request, reply) => {
    const { id: conocimientoId } = request.params as { id: string };
    const body = request.body as QuestionInput;
    if (body.type === "multiple_choice" && !oneComplete(body.options)) {
      return reply.code(400).send({ error: "una_completa" });
    }
    const id = randomUUID();
    await app.pool.query(
      `INSERT INTO preguntas (id, conocimiento_id, type, prompt, correct, expected_answer)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, conocimientoId, body.type, body.prompt, body.correct ?? null, body.expectedAnswer ?? null],
    );
    if (body.type === "multiple_choice") await insertOptions(app, id, body.options ?? []);
    return reply.code(201).send({ id });
  });

  app.patch("/preguntas/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as QuestionInput;
    if (body.type === "multiple_choice" && !oneComplete(body.options)) {
      return reply.code(400).send({ error: "una_completa" });
    }
    await app.pool.query(
      "UPDATE preguntas SET type = $2, prompt = $3, correct = $4, expected_answer = $5 WHERE id = $1",
      [id, body.type, body.prompt, body.correct ?? null, body.expectedAnswer ?? null],
    );
    await app.pool.query("DELETE FROM opciones WHERE pregunta_id = $1", [id]);
    if (body.type === "multiple_choice") await insertOptions(app, id, body.options ?? []);
    return { id };
  });

  app.delete("/preguntas/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await app.pool.query("DELETE FROM preguntas WHERE id = $1", [id]);
    return reply.code(204).send();
  });
}
