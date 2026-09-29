import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.ts";

test("sin AUTH_PASSWORD el proceso no arma la app", () => {
  const previous = process.env.AUTH_PASSWORD;
  delete process.env.AUTH_PASSWORD;
  assert.throws(() => buildApp({ databaseUrl: "postgres://localhost/conocimiento", mediaDir: "/tmp" }), /AUTH_PASSWORD/);
  if (previous) process.env.AUTH_PASSWORD = previous;
});
