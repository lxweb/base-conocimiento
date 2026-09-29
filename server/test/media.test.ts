import assert from "node:assert/strict";
import test from "node:test";
import { login, startTestApp } from "./helpers.ts";

async function conocimientoId(app: Awaited<ReturnType<typeof startTestApp>>, token: string): Promise<string> {
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
    payload: { title: "C", explanation: "E" },
  });
  return conocimiento.json().id as string;
}

test("una imagen de más de 10 MB no se adjunta y el conocimiento sigue existiendo", async () => {
  const app = await startTestApp();
  const token = await login(app);
  const id = await conocimientoId(app, token);
  const response = await app.inject({
    method: "POST",
    url: `/conocimientos/${id}/medios`,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/octet-stream",
      "x-filename": "foto.png",
      "x-kind": "image",
    },
    payload: Buffer.alloc(10 * 1024 * 1024 + 1),
  });
  assert.equal(response.statusCode, 413);
  const tree = await app.inject({
    method: "GET",
    url: "/materias",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(tree.json()[0].ramas[0].temas[0].conocimientos[0].medios.length, 0);
  await app.close();
});
