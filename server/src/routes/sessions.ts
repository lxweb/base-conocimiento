import { randomUUID } from "node:crypto";
import {
  applyPoints,
  chooseQuestion,
  gradeBoolean,
  gradeOption,
  gradeWritten,
  nextSchedule,
  selectQueue,
  type OptionKind,
  type Outcome,
  type Priority,
  type QueueCandidate,
  type Schedule,
} from "@base/domain";
import type { FastifyInstance } from "fastify";

type SessionItemRow = {
  id: string;
  position: number;
  conocimiento_id: string;
  snapshot: SessionSnapshot;
};

type SessionSnapshot = {
  question: {
    id: string;
    type: string;
    prompt: string;
    correct: boolean | null;
    expectedAnswer: string | null;
    options: { id: string; text: string; kind: string }[];
  };
  conocimiento: {
    title: string;
    explanation: string;
    example: string | null;
    link: string | null;
    medios: { id: string; kind: string }[];
  };
};

type AnswerInput = {
  id: string;
  sessionItemId: string;
  answeredAt: string;
  booleanChoice: boolean | null;
  optionId: string | null;
  writtenText: string | null;
  equivalent: boolean | null;
};

type AnswerResult =
  | { id: string; status: "applied"; outcome: Outcome }
  | { id: string; status: "rejected" };

function formatLocalDate(value: Date | string | null): string | null {
  if (value === null) return null;
  if (typeof value === "string") return value.slice(0, 10);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function mapSessionItem(row: SessionItemRow) {
  return {
    id: row.id,
    position: row.position,
    conocimientoId: row.conocimiento_id,
    snapshot: row.snapshot,
  };
}

async function loadUnansweredItems(app: FastifyInstance, sesionId: string) {
  const result = await app.pool.query<SessionItemRow>(
    `SELECT si.id, si.position, si.conocimiento_id, si.snapshot
     FROM sesion_items si
     LEFT JOIN respuestas r ON r.sesion_item_id = si.id
     WHERE si.sesion_id = $1 AND r.id IS NULL
     ORDER BY si.position`,
    [sesionId],
  );
  return result.rows.map(mapSessionItem);
}

async function loadCandidates(app: FastifyInstance): Promise<
  (QueueCandidate & { temaPoints: number; temaId: string })[]
> {
  const result = await app.pool.query(
    `SELECT
       c.id,
       c.consecutive_full_successes,
       c.had_full_success,
       c.due_on,
       c.archived_at,
       c.position AS conocimiento_position,
       t.id AS tema_id,
       t.priority,
       t.points,
       t.position AS tema_position,
       r.position AS rama_position,
       m.position AS materia_position,
       COUNT(p.id) AS question_count
     FROM conocimientos c
     JOIN temas t ON t.id = c.tema_id
     JOIN ramas r ON r.id = t.rama_id
     JOIN materias m ON m.id = r.materia_id
     LEFT JOIN preguntas p ON p.conocimiento_id = c.id
     GROUP BY c.id, t.id, r.id, m.id`,
  );

  return result.rows.map((row) => ({
    conocimientoId: row.id as string,
    priority: row.priority as Priority,
    consecutiveFullSuccesses: row.consecutive_full_successes as number,
    hadFullSuccess: row.had_full_success as boolean,
    dueOn: formatLocalDate(row.due_on as Date | null),
    archived: row.archived_at !== null,
    hasQuestion: Number(row.question_count) > 0,
    materiaPosition: row.materia_position as number,
    ramaPosition: row.rama_position as number,
    temaPosition: row.tema_position as number,
    conocimientoPosition: row.conocimiento_position as number,
    temaPoints: row.points as number,
    temaId: row.tema_id as string,
  }));
}

async function buildSnapshot(
  app: FastifyInstance,
  conocimientoId: string,
  questionId: string,
): Promise<SessionSnapshot> {
  const conocimiento = await app.pool.query(
    "SELECT title, explanation, example, link FROM conocimientos WHERE id = $1",
    [conocimientoId],
  );
  const pregunta = await app.pool.query(
    "SELECT id, type, prompt, correct, expected_answer FROM preguntas WHERE id = $1",
    [questionId],
  );
  const opciones = await app.pool.query(
    "SELECT id, text, kind FROM opciones WHERE pregunta_id = $1 ORDER BY position",
    [questionId],
  );
  const medios = await app.pool.query(
    "SELECT id, kind FROM medios WHERE conocimiento_id = $1",
    [conocimientoId],
  );
  const c = conocimiento.rows[0];
  const q = pregunta.rows[0];
  return {
    question: {
      id: q.id as string,
      type: q.type as string,
      prompt: q.prompt as string,
      correct: q.correct as boolean | null,
      expectedAnswer: q.expected_answer as string | null,
      options: opciones.rows.map((option) => ({
        id: option.id as string,
        text: option.text as string,
        kind: option.kind as string,
      })),
    },
    conocimiento: {
      title: c.title as string,
      explanation: c.explanation as string,
      example: c.example as string | null,
      link: c.link as string | null,
      medios: medios.rows.map((medio) => ({
        id: medio.id as string,
        kind: medio.kind as string,
      })),
    },
  };
}

function gradeFromSnapshot(snapshot: SessionSnapshot, answer: AnswerInput): Outcome | null {
  const question = snapshot.question;
  if (question.type === "boolean") {
    return gradeBoolean(Boolean(question.correct), Boolean(answer.booleanChoice));
  }
  if (question.type === "multiple_choice") {
    const option = question.options.find((item) => item.id === answer.optionId);
    if (!option) return null;
    return gradeOption(option.kind as OptionKind);
  }
  if (question.type === "written") {
    return gradeWritten(answer.equivalent === true);
  }
  return null;
}

export function registerSessions(app: FastifyInstance): void {
  app.post("/sesiones", async (request) => {
    const body = request.body as { localDate: string };
    const localDate = body.localDate;

    const existing = await app.pool.query("SELECT id FROM sesiones WHERE local_date = $1", [localDate]);
    if (existing.rows[0]) {
      const sesionId = existing.rows[0].id as string;
      const items = await loadUnansweredItems(app, sesionId);
      return { id: sesionId, items };
    }

    const candidates = await loadCandidates(app);
    const ids = selectQueue(candidates, localDate);
    const sesionId = randomUUID();
    const items: ReturnType<typeof mapSessionItem>[] = [];
    let position = 1;

    const client = await app.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("INSERT INTO sesiones (id, local_date) VALUES ($1, $2)", [sesionId, localDate]);

      for (const conocimientoId of ids) {
        const candidate = candidates.find((item) => item.conocimientoId === conocimientoId);
        if (!candidate) continue;

        const preguntas = await client.query(
          "SELECT id, type, last_asked_on FROM preguntas WHERE conocimiento_id = $1",
          [conocimientoId],
        );
        const chosen = chooseQuestion(
          candidate.temaPoints,
          preguntas.rows.map((pregunta) => ({
            id: pregunta.id as string,
            type: pregunta.type as "boolean" | "multiple_choice" | "written",
            lastAskedOn: formatLocalDate(pregunta.last_asked_on as Date | null),
          })),
        );
        if (!chosen) continue;

        const snapshot = await buildSnapshot(app, conocimientoId, chosen.id);
        const itemId = randomUUID();
        await client.query(
          "INSERT INTO sesion_items (id, sesion_id, position, conocimiento_id, snapshot) VALUES ($1, $2, $3, $4, $5)",
          [itemId, sesionId, position, conocimientoId, JSON.stringify(snapshot)],
        );
        await client.query("UPDATE preguntas SET last_asked_on = $2 WHERE id = $1", [chosen.id, localDate]);
        items.push({
          id: itemId,
          position,
          conocimientoId,
          snapshot,
        });
        position += 1;
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    return { id: sesionId, items };
  });

  app.post("/respuestas", async (request, reply) => {
    const body = request.body as { answers: AnswerInput[] };
    const sorted = [...body.answers].sort((a, b) => {
      const byTime = a.answeredAt.localeCompare(b.answeredAt);
      return byTime !== 0 ? byTime : a.id.localeCompare(b.id);
    });

    const results: AnswerResult[] = [];

    for (const answer of sorted) {
      const existing = await app.pool.query("SELECT outcome FROM respuestas WHERE id = $1", [answer.id]);
      if (existing.rows[0]) {
        results.push({
          id: answer.id,
          status: "applied",
          outcome: existing.rows[0].outcome as Outcome,
        });
        continue;
      }

      const client = await app.pool.connect();
      try {
        await client.query("BEGIN");

        const itemResult = await client.query(
          `SELECT si.snapshot, si.conocimiento_id, s.local_date
           FROM sesion_items si
           JOIN sesiones s ON s.id = si.sesion_id
           WHERE si.id = $1`,
          [answer.sessionItemId],
        );
        if (!itemResult.rows[0]) {
          await client.query("ROLLBACK");
          results.push({ id: answer.id, status: "rejected" });
          continue;
        }

        const snapshot = itemResult.rows[0].snapshot as SessionSnapshot;
        const conocimientoId = itemResult.rows[0].conocimiento_id as string;
        const sessionDate = formatLocalDate(itemResult.rows[0].local_date as Date)!;

        const outcome = gradeFromSnapshot(snapshot, answer);
        if (outcome === null) {
          await client.query("ROLLBACK");
          results.push({ id: answer.id, status: "rejected" });
          continue;
        }

        const conocimiento = await client.query(
          `SELECT archived_at, consecutive_full_successes, base_interval_days, due_on, had_full_success, tema_id
           FROM conocimientos WHERE id = $1`,
          [conocimientoId],
        );
        const row = conocimiento.rows[0];
        const temaId = row.tema_id as string;

        const tema = await client.query("SELECT points, priority FROM temas WHERE id = $1", [temaId]);
        const temaRow = tema.rows[0];
        const newPoints = applyPoints(temaRow.points as number, outcome);
        await client.query("UPDATE temas SET points = $2 WHERE id = $1", [temaId, newPoints]);

        if (row.archived_at === null) {
          const schedule: Schedule = {
            consecutiveFullSuccesses: row.consecutive_full_successes as number,
            baseIntervalDays: row.base_interval_days as number,
            dueOn: formatLocalDate(row.due_on as Date | null),
            hadFullSuccess: row.had_full_success as boolean,
          };
          const updated = nextSchedule({
            schedule,
            outcome,
            priority: temaRow.priority as Priority,
            sessionDate,
          });
          await client.query(
            `UPDATE conocimientos
             SET consecutive_full_successes = $2,
                 base_interval_days = $3,
                 due_on = $4,
                 had_full_success = $5
             WHERE id = $1`,
            [
              conocimientoId,
              updated.consecutiveFullSuccesses,
              updated.baseIntervalDays,
              updated.dueOn,
              updated.hadFullSuccess,
            ],
          );
        }

        await client.query(
          `INSERT INTO respuestas (id, sesion_item_id, outcome, answered_at, applied_at)
           VALUES ($1, $2, $3, $4, now())`,
          [answer.id, answer.sessionItemId, outcome, answer.answeredAt],
        );

        await client.query("COMMIT");
        results.push({ id: answer.id, status: "applied", outcome });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }

    const rejected = results.some((result) => result.status === "rejected");
    return reply.code(rejected ? 422 : 200).send({ results });
  });
}
