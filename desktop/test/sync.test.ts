import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { openOutbox, type PendingAnswer } from "../src/outbox.ts";
import { flushOutbox, type SyncResult } from "../src/sync.ts";

function answer(id: string): PendingAnswer {
  return {
    id,
    sessionItemId: "22222222-2222-2222-2222-222222222222",
    answeredAt: "2026-09-28T12:00:00.000Z",
    booleanChoice: true,
    optionId: null,
    writtenText: null,
    equivalent: null,
  };
}

test("borra la fila confirmada y la rechazada, y conserva la que no llegó", async () => {
  const box = openOutbox(join(mkdtempSync(join(tmpdir(), "sync-")), "local.sqlite"));
  box.enqueue(answer("aaaa"));
  box.enqueue(answer("bbbb"));
  box.enqueue(answer("cccc"));
  const result = await flushOutbox(box, async (pending) => {
    if (pending.id === "aaaa") return { status: "applied" };
    if (pending.id === "bbbb") return { status: "rejected" };
    throw new Error("red");
  });
  assert.equal(result.needsLogin, false);
  assert.deepEqual(box.list().map((item) => item.id), ["cccc"]);
  box.close();
});

test("un 401 pide login y no borra la bandeja", async () => {
  const box = openOutbox(join(mkdtempSync(join(tmpdir(), "sync-")), "local.sqlite"));
  box.saveToken("viejo");
  box.enqueue(answer("aaaa"));
  const result: SyncResult = await flushOutbox(box, async () => ({ status: "unauthorized" }));
  assert.equal(result.needsLogin, true);
  assert.equal(box.loadToken(), null);
  assert.equal(box.list().length, 1);
  box.close();
});
