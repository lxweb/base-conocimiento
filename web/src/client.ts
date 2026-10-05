import { ApiError, createApi, type PendingAnswer } from "../../desktop/src/api.ts";
import { mediaKindFromFile } from "../../desktop/src/renderer/ficha.ts";
import { enqueueOutbox, listOutbox, removeOutbox } from "./outbox.ts";

const TOKEN_KEY = "bc-token";
const SESSION_KEY = "bc-session";

function localDate(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function createWebClient() {
  const api = createApi("", () => localStorage.getItem(TOKEN_KEY));
  let onLoginRequired: (() => void) | null = null;

  async function flushOutbox(): Promise<{ needsLogin: boolean }> {
    let needsLogin = false;
    for (const answer of listOutbox()) {
      try {
        const result = await api.submitAnswer(answer);
        if (result.status === "unauthorized") {
          localStorage.removeItem(TOKEN_KEY);
          needsLogin = true;
          onLoginRequired?.();
          break;
        }
        if (result.status === "applied" || result.status === "rejected") removeOutbox(answer.id);
      } catch {
        break;
      }
    }
    return { needsLogin };
  }

  return {
    async login(password: string): Promise<void> {
      const result = await api.login(password);
      localStorage.setItem(TOKEN_KEY, result.token);
      await flushOutbox();
    },
    async loadTree() {
      return api.materias();
    },
    createMateria(name: string) {
      return api.createMateria(name);
    },
    createRama(materiaId: string, name: string) {
      return api.createRama(materiaId, name);
    },
    createTema(ramaId: string, name: string, priority: string) {
      return api.createTema(ramaId, name, priority);
    },
    createConocimiento(temaId: string, body: { title: string; explanation: string }) {
      return api.createConocimiento(temaId, body);
    },
    updateConocimiento(
      id: string,
      body: { title: string; explanation: string; example: string | null; link: string | null },
    ) {
      return api.updateConocimiento(id, body);
    },
    archive(id: string) {
      return api.archive(id);
    },
    restore(id: string) {
      return api.restore(id);
    },
    saveQuestion(conocimientoId: string, body: unknown) {
      return api.saveQuestion(conocimientoId, body);
    },
    saveRelation(fromId: string, toId: string, type: string) {
      return api.saveRelation(fromId, toId, type);
    },
    reorder(kind: string, parentId: string | null, orderedIds: string[]) {
      return api.reorder(kind, parentId, orderedIds);
    },
    updateTema(id: string, priority: string) {
      return api.updateTema(id, { priority });
    },
    async uploadMedia(conocimientoId: string, file: File) {
      const kind = mediaKindFromFile(file);
      if (!kind) throw new Error("tipo");
      await api.uploadMedia(conocimientoId, file, file.name, kind);
    },
    async previewMedia(id: string) {
      const blob = await api.fetchMedia(id);
      if (!blob) return null;
      return URL.createObjectURL(blob);
    },
    async openSession() {
      const date = localDate();
      try {
        const session = await api.openSession(date);
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({ localDate: date, session }));
        return { session };
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          localStorage.removeItem(TOKEN_KEY);
          return { needsLogin: true as const };
        }
        const cached = sessionStorage.getItem(SESSION_KEY);
        if (cached) {
          const parsed = JSON.parse(cached) as { localDate: string; session: unknown };
          if (parsed.localDate === date) return { session: parsed.session, offline: true as const };
        }
        return { error: "red" as const };
      }
    },
    async enqueue(answer: PendingAnswer) {
      enqueueOutbox(answer);
      return flushOutbox();
    },
    notifyOnline() {
      return flushOutbox();
    },
    onNeedsLogin(callback: () => void) {
      onLoginRequired = callback;
    },
    startBackgroundSync() {
      const tick = () => {
        if (listOutbox().length > 0) void flushOutbox();
      };
      window.addEventListener("online", tick);
      setInterval(tick, 60_000);
      return tick;
    },
  };
}

export type WebClient = ReturnType<typeof createWebClient>;
