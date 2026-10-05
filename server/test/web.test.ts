import assert from "node:assert/strict";
import test from "node:test";
import { startTestApp } from "./helpers.ts";

test("GET / sirve la UI web sin token", async () => {
  const app = await startTestApp();
  const response = await app.inject({ method: "GET", url: "/" });
  assert.equal(response.statusCode, 200);
  assert.match(response.body, /Base de conocimiento/);
  await app.close();
});

test("GET /assets/boot.js sirve el bundle sin token", async () => {
  const app = await startTestApp();
  const response = await app.inject({ method: "GET", url: "/assets/boot.js" });
  assert.equal(response.statusCode, 200);
  assert.match(response.headers["content-type"] ?? "", /javascript/);
  await app.close();
});
