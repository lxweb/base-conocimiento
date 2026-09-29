import type { PendingAnswer } from "./outbox.ts";

export type SyncStatus = "applied" | "rejected" | "unauthorized";
export type SyncResult = { needsLogin: boolean };

type Box = {
  list(): PendingAnswer[];
  remove(id: string): void;
  clearToken(): void;
};

export async function flushOutbox(
  box: Box,
  send: (answer: PendingAnswer) => Promise<{ status: SyncStatus }>,
): Promise<SyncResult> {
  let needsLogin = false;
  for (const answer of box.list()) {
    try {
      const result = await send(answer);
      if (result.status === "unauthorized") {
        box.clearToken();
        needsLogin = true;
        break;
      }
      if (result.status === "applied" || result.status === "rejected") box.remove(answer.id);
    } catch {
      break;
    }
  }
  return { needsLogin };
}
