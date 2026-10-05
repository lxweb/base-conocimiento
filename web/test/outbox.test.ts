import assert from "node:assert/strict";
import test from "node:test";
import { enqueueOutbox, listOutbox, removeOutbox } from "../src/outbox.ts";

class MemoryStorage {
  #data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.#data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.#data.set(key, value);
  }

  removeItem(key: string): void {
    this.#data.delete(key);
  }
}

test("la bandeja del navegador conserva respuestas hasta confirmar", () => {
  (globalThis as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
  const answer = {
    id: "11111111-1111-1111-1111-111111111111",
    sessionItemId: "22222222-2222-2222-2222-222222222222",
    answeredAt: "2026-09-28T12:00:00.000Z",
    booleanChoice: true,
    optionId: null,
    writtenText: null,
    equivalent: null,
  };
  enqueueOutbox(answer);
  assert.equal(listOutbox().length, 1);
  removeOutbox(answer.id);
  assert.equal(listOutbox().length, 0);
});
