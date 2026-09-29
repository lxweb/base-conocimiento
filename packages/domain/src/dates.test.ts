import assert from "node:assert/strict";
import test from "node:test";
import { addDays, daysOverdue } from "./dates.ts";

test("suma días dentro del mes", () => {
  assert.equal(addDays("2026-09-28", 1), "2026-09-29");
  assert.equal(addDays("2026-09-28", 3), "2026-10-01");
});

test("un vencimiento vacío es lo más atrasado", () => {
  assert.equal(daysOverdue(null, "2026-09-28"), Number.POSITIVE_INFINITY);
});

test("cuenta días de atraso y cero si vence hoy", () => {
  assert.equal(daysOverdue("2026-09-26", "2026-09-28"), 2);
  assert.equal(daysOverdue("2026-09-28", "2026-09-28"), 0);
});

test("rechaza una fecha mal formada", () => {
  assert.throws(() => addDays("28-09-2026", 1), /Fecha inválida/);
});
