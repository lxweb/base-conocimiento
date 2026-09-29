import assert from "node:assert/strict";
import test from "node:test";
import { login, startTestApp } from "./helpers.ts";

test("crea la jerarquía, una pregunta, una relación y archiva sin borrar", async () => {
  const app = await startTestApp();
  const token = await login(app);
  const headers = { authorization: `Bearer ${token}` };

  const materia = await app.inject({ method: "POST", url: "/materias", headers, payload: { name: "Física" } });
  const rama = await app.inject({
    method: "POST",
    url: `/materias/${materia.json().id}/ramas`,
    headers,
    payload: { name: "Mecánica" },
  });
  const tema = await app.inject({
    method: "POST",
    url: `/ramas/${rama.json().id}/temas`,
    headers,
    payload: { name: "Newton", priority: "alta" },
  });
  const uno = await app.inject({
    method: "POST",
    url: `/temas/${tema.json().id}/conocimientos`,
    headers,
    payload: { title: "Inercia", explanation: "Un cuerpo conserva su estado." },
  });
  const dos = await app.inject({
    method: "POST",
    url: `/temas/${tema.json().id}/conocimientos`,
    headers,
    payload: { title: "Fuerza", explanation: "Cambia el estado de movimiento." },
  });
  const pregunta = await app.inject({
    method: "POST",
    url: `/conocimientos/${uno.json().id}/preguntas`,
    headers,
    payload: { type: "boolean", prompt: "La inercia conserva el estado", correct: true },
  });
  assert.equal(pregunta.statusCode, 201);

  const self = await app.inject({
    method: "PUT",
    url: "/relaciones",
    headers,
    payload: { fromId: uno.json().id, toId: uno.json().id, type: "prerrequisito" },
  });
  assert.equal(self.statusCode, 400);

  const relacion = await app.inject({
    method: "PUT",
    url: "/relaciones",
    headers,
    payload: { fromId: uno.json().id, toId: dos.json().id, type: "prerrequisito" },
  });
  assert.equal(relacion.statusCode, 200);

  const archived = await app.inject({
    method: "POST",
    url: `/conocimientos/${uno.json().id}/archive`,
    headers,
  });
  assert.equal(archived.json().archived, true);

  const tree = await app.inject({ method: "GET", url: "/materias", headers });
  const conocimiento = tree.json()[0].ramas[0].temas[0].conocimientos[0];
  assert.equal(conocimiento.archived, true);
  assert.equal(conocimiento.preguntas.length, 1);
  assert.equal(conocimiento.relaciones.length, 1);

  await app.close();
});

test("una opción múltiple exige exactamente una opción completa", async () => {
  const app = await startTestApp();
  const headers = { authorization: `Bearer ${await login(app)}` };
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
    payload: { title: "C", explanation: "E" },
  });
  const bad = await app.inject({
    method: "POST",
    url: `/conocimientos/${conocimiento.json().id}/preguntas`,
    headers,
    payload: {
      type: "multiple_choice",
      prompt: "P",
      options: [{ text: "a", kind: "falsa" }, { text: "b", kind: "verdadera" }],
    },
  });
  assert.equal(bad.statusCode, 400);
  await app.close();
});
