import type { PendingAnswer } from "../../desktop/src/api.ts";

const KEY = "bc-outbox";

export function listOutbox(): PendingAnswer[] {
  const raw = localStorage.getItem(KEY);
  if (!raw) return [];
  return JSON.parse(raw) as PendingAnswer[];
}

function saveOutbox(items: PendingAnswer[]): void {
  localStorage.setItem(KEY, JSON.stringify(items));
}

export function enqueueOutbox(answer: PendingAnswer): void {
  saveOutbox([...listOutbox(), answer]);
}

export function removeOutbox(id: string): void {
  saveOutbox(listOutbox().filter((item) => item.id !== id));
}
