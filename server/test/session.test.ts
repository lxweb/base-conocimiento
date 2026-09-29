import assert from "node:assert/strict";
import test from "node:test";
import { login, startTestApp } from "./helpers.ts";

async function seed(app: Awaited<ReturnType<typeof startTestApp>>, token: string) {
  const headers = { authorization: `Bearer ${token}` };
  const materia = await app.inject({ method: "POST", url: "/materias", headers, payload: { name: "M" } });
  const rama = await app.inject({
    method: "POST",
    url: `/materias/${materia.json().id}/ramas`,
    headers,
    payload: { name: "R" },
  });
  const tema = await app.inject({
    method: "POST",
    url: `/ramas/${rama.json().id}/temas`,
    headers,
    payload: { name: "T", priority: "normal" },
  });
  const conocimiento = await app.inject({
    method: "POST",
    url: `/temas/${tema.json().id}/conocimientos`,
    headers,
    payload: { title: "Inercia", explanation: "Conserva el estado." },
  });
  await app.inject({
    method: "POST",
    url: `/conocimientos/${conocimiento.json().id}/preguntas`,
    headers,
    payload: { type: "boolean", prompt: "Conserva el estado", correct: true },
  });
  return { headers, conocimientoId: conocimiento.json().id as string, temaId: tema.json().id as string };
}

test("la misma fecha devuelve la misma sesión y un UUID repetido no mueve los puntos dos veces", async () => {
  const app = await startTestApp();
  const token = await login(app);
  const { headers, temaId } = await seed(app, token);
  const first = await app.inject({ method: "POST", url: "/sesiones", headers, payload: { localDate: "2026-09-28" } });
  const second = await app.inject({ method: "POST", url: "/sesiones", headers, payload: { localDate: "2026-09-28" } });
  assert.equal(first.json().id, second.json().id);
  const item = first.json().items[0];
  const answer = {
    id: "11111111-1111-1111-1111-111111111111",
    sessionItemId: item.id,
    answeredAt: "2026-09-28T12:00:00.000Z",
    booleanChoice: true,
    optionId: null,
    writtenText: null,
    equivalent: null,
  };
  const applied = await app.inject({ method: "POST", url: "/respuestas", headers, payload: { answers: [answer] } });
  const replay = await app.inject({ method: "POST", url: "/respuestas", headers, payload: { answers: [answer] } });
  assert.equal(applied.json().results[0].outcome, "pleno");
  assert.equal(replay.json().results[0].outcome, "pleno");
  const tema = await app.inject({ method: "GET", url: `/temas/${temaId}`, headers });
  assert.equal(tema.json().points, 1);
  await app.close();
});

test("una respuesta de otra sesión se rechaza", async () => {
  const app = await startTestApp();
  const token = await login(app);
  const { headers } = await seed(app, token);
  await app.inject({ method: "POST", url: "/sesiones", headers, payload: { localDate: "2026-09-28" } });
  const response = await app.inject({
    method: "POST",
    url: "/respuestas",
    headers,
    payload: {
      answers: [{
        id: "22222222-2222-2222-2222-222222222222",
        sessionItemId: "33333333-3333-3333-3333-333333333333",
        answeredAt: "2026-09-28T12:00:00.000Z",
        booleanChoice: true,
        optionId: null,
        writtenText: null,
        equivalent: null,
      }],
    },
  });
  assert.equal(response.statusCode, 422);
  assert.equal(response.json().results[0].status, "rejected");
  await app.close();
});

test("archivar después de emitir la sesión mueve puntos y no reprograma", async () => {
  const app = await startTestApp();
  const token = await login(app);
  const { headers, conocimientoId, temaId } = await seed(app, token);
  const session = await app.inject({
    method: "POST",
    url: "/sesiones",
    headers,
    payload: { localDate: "2026-09-28" },
  });
  await app.inject({ method: "POST", url: `/conocimientos/${conocimientoId}/archive`, headers });
  const item = session.json().items[0];
  await app.inject({
    method: "POST",
    url: "/respuestas",
    headers,
    payload: {
      answers: [{
        id: "44444444-4444-4444-4444-444444444444",
        sessionItemId: item.id,
        answeredAt: "2026-09-28T12:00:00.000Z",
        booleanChoice: true,
        optionId: null,
        writtenText: null,
        equivalent: null,
      }],
    },
  });
  const stored = await app.pool.query(
    "SELECT consecutive_full_successes, base_interval_days, due_on FROM conocimientos WHERE id = $1",
    [conocimientoId],
  );
  assert.equal(stored.rows[0].consecutive_full_successes, 0);
  assert.equal(stored.rows[0].base_interval_days, 0);
  assert.equal(stored.rows[0].due_on, null);
  const tema = await app.inject({ method: "GET", url: `/temas/${temaId}`, headers });
  assert.equal(tema.json().points, 1);
  await app.close();
});

test("califica contra la copia de la sesión aunque la pregunta viva cambie", async () => {
  const app = await startTestApp();
  const token = await login(app);
  const { headers } = await seed(app, token);
  const session = await app.inject({
    method: "POST",
    url: "/sesiones",
    headers,
    payload: { localDate: "2026-09-28" },
  });
  const item = session.json().items[0];
  const preguntaId = item.snapshot.question.id as string;
  await app.inject({
    method: "PATCH",
    url: `/preguntas/${preguntaId}`,
    headers,
    payload: { type: "boolean", prompt: "Cambiada", correct: false },
  });
  const applied = await app.inject({
    method: "POST",
    url: "/respuestas",
    headers,
    payload: {
      answers: [{
        id: "55555555-5555-5555-5555-555555555555",
        sessionItemId: item.id,
        answeredAt: "2026-09-28T12:00:00.000Z",
        booleanChoice: true,
        optionId: null,
        writtenText: null,
        equivalent: null,
      }],
    },
  });
  assert.equal(applied.json().results[0].outcome, "pleno");
  await app.close();
});
