import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { openOutbox, type PendingAnswer } from "../src/outbox.ts";

const answer: PendingAnswer = {
  id: "11111111-1111-1111-1111-111111111111",
  sessionItemId: "22222222-2222-2222-2222-222222222222",
  answeredAt: "2026-09-28T12:00:00.000Z",
  booleanChoice: true,
  optionId: null,
  writtenText: null,
  equivalent: null,
};

test("una respuesta sigue en sqlite hasta que se confirma", () => {
  const dir = mkdtempSync(join(tmpdir(), "bandeja-"));
  const path = join(dir, "local.sqlite");
  const first = openOutbox(path);
  first.enqueue(answer);
  first.close();
  const second = openOutbox(path);
  assert.equal(second.list().length, 1);
  assert.equal(second.list()[0].id, answer.id);
  second.remove(answer.id);
  assert.equal(second.list().length, 0);
  second.close();
});

test("pedir la contraseña de nuevo no borra la bandeja", () => {
  const dir = mkdtempSync(join(tmpdir(), "bandeja-"));
  const box = openOutbox(join(dir, "local.sqlite"));
  box.enqueue(answer);
  box.saveToken("token-viejo");
  box.clearToken();
  assert.equal(box.loadToken(), null);
  assert.equal(box.list().length, 1);
  box.close();
});
