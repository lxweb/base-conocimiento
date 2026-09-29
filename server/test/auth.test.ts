import assert from "node:assert/strict";
import test from "node:test";
import { login, startTestApp } from "./helpers.ts";

test("la contraseña correcta devuelve un token que abre una ruta privada", async () => {
  const app = await startTestApp();
  const denied = await app.inject({ method: "GET", url: "/materias" });
  assert.equal(denied.statusCode, 401);
  const token = await login(app);
  const allowed = await app.inject({
    method: "GET",
    url: "/materias",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(allowed.statusCode, 200);
  assert.deepEqual(allowed.json(), []);
  await app.close();
});

test("una contraseña incorrecta no entrega token", async () => {
  const app = await startTestApp();
  const response = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { password: "otra" },
  });
  assert.equal(response.statusCode, 401);
  await app.close();
});
