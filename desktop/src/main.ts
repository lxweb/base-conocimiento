import { mkdir, readFile, writeFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { join, sep } from "node:path";
import { app, BrowserWindow, ipcMain, protocol } from "electron";
import { ApiError, createApi } from "./api.ts";
import { openOutbox, type PendingAnswer } from "./outbox.ts";
import { mediaKindFromFile } from "./renderer/ficha.ts";
import { flushOutbox } from "./sync.ts";

const rendererRoot = join(import.meta.dirname, "renderer");
const baseUrl = process.env.API_URL ?? "http://127.0.0.1:3000";

protocol.registerSchemesAsPrivileged([
  { scheme: "study", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

function localDate(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

type Medio = { id: string };
type SessionPayload = { items?: Array<{ snapshot?: { conocimiento?: { medios?: Medio[] }; knowledge?: { medios?: Medio[] } } }> };

function mediaOf(session: SessionPayload): Medio[] {
  const found: Medio[] = [];
  for (const item of session.items ?? []) {
    const medios = item.snapshot?.conocimiento?.medios ?? item.snapshot?.knowledge?.medios ?? [];
    found.push(...medios);
  }
  return found;
}

let window: BrowserWindow | null = null;

function showLogin() {
  window?.webContents.send("needs-login");
}

async function main() {
  const box = openOutbox(join(app.getPath("userData"), "local.sqlite"));
  const api = createApi(baseUrl, () => box.loadToken());
  const mediaDir = join(app.getPath("userData"), "medios");

  async function flush() {
    const result = await flushOutbox(box, (answer) => api.submitAnswer(answer));
    if (result.needsLogin) showLogin();
    return result;
  }

  async function saveDownloaded(session: SessionPayload) {
    await mkdir(mediaDir, { recursive: true });
    const token = box.loadToken();
    for (const medio of mediaOf(session)) {
      try {
        const response = await fetch(`${baseUrl}/medios/${medio.id}`, {
          headers: token ? { authorization: `Bearer ${token}` } : {},
        });
        if (!response.ok) continue;
        await writeFile(join(mediaDir, medio.id), Buffer.from(await response.arrayBuffer()));
      } catch {
        continue;
      }
    }
  }

  protocol.handle("study", async (request) => {
    const url = new URL(request.url);
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const filePath = join(rendererRoot, relative);
    if (filePath !== rendererRoot && !filePath.startsWith(rendererRoot + sep)) {
      return new Response("forbidden", { status: 403 });
    }
    const bytes = await readFile(filePath);
    if (filePath.endsWith(".ts")) {
      const source = stripTypeScriptTypes(bytes.toString("utf8"));
      return new Response(source, { headers: { "content-type": "text/javascript; charset=utf-8" } });
    }
    if (filePath.endsWith(".html")) {
      return new Response(bytes, { headers: { "content-type": "text/html; charset=utf-8" } });
    }
    return new Response(bytes);
  });

  ipcMain.handle("login", async (_event, password: string) => {
    const result = await api.login(password);
    box.saveToken(result.token);
  });
  ipcMain.handle("load-tree", () => api.materias());
  ipcMain.handle("create-materia", (_event, name: string) => api.createMateria(name));
  ipcMain.handle("create-rama", (_event, materiaId: string, name: string) => api.createRama(materiaId, name));
  ipcMain.handle("create-tema", (_event, ramaId: string, name: string, priority: string) =>
    api.createTema(ramaId, name, priority),
  );
  ipcMain.handle("create-conocimiento", (_event, temaId: string, body: Record<string, unknown>) =>
    api.createConocimiento(temaId, body),
  );
  ipcMain.handle("update-conocimiento", (_event, id: string, body: Record<string, unknown>) =>
    api.updateConocimiento(id, body),
  );
  ipcMain.handle("archive", (_event, id: string) => api.archive(id));
  ipcMain.handle("restore", (_event, id: string) => api.restore(id));
  ipcMain.handle("save-question", (_event, conocimientoId: string, body: Record<string, unknown>) =>
    api.saveQuestion(conocimientoId, body),
  );
  ipcMain.handle("save-relation", (_event, fromId: string, toId: string, type: string) =>
    api.saveRelation(fromId, toId, type),
  );
  ipcMain.handle("reorder", (_event, kind: string, parentId: string | null, orderedIds: string[]) =>
    api.reorder(kind, parentId, orderedIds),
  );
  ipcMain.handle("update-tema", (_event, id: string, priority: string) => api.updateTema(id, { priority }));
  ipcMain.handle(
    "upload-media",
    async (_event, id: string, file: { name: string; type: string; bytes: ArrayBuffer }) => {
      const kind = mediaKindFromFile({ type: file.type });
      if (!kind) throw new Error("tipo");
      return api.uploadMedia(id, Buffer.from(file.bytes), file.name, kind);
    },
  );
  ipcMain.handle("preview-media", async (_event, id: string) => {
    const blob = await api.fetchMedia(id);
    if (!blob) return null;
    const buffer = Buffer.from(await blob.arrayBuffer());
    return `data:${blob.type || "application/octet-stream"};base64,${buffer.toString("base64")}`;
  });
  ipcMain.handle("open-session", async () => {
    const date = localDate();
    try {
      const session = (await api.openSession(date)) as SessionPayload;
      box.saveSession({ localDate: date, payload: JSON.stringify(session) });
      await saveDownloaded(session);
      return { session };
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        box.clearToken();
        return { needsLogin: true };
      }
      const stored = box.loadSession();
      if (stored && stored.localDate === date) return { session: JSON.parse(stored.payload) as SessionPayload, offline: true };
      return { error: "red" };
    }
  });
  ipcMain.handle("enqueue", async (_event, answer: PendingAnswer) => {
    box.enqueue(answer);
    return flush();
  });
  ipcMain.on("online", () => {
    void flush();
  });

  window = new BrowserWindow({
    width: 960,
    height: 800,
    backgroundColor: "#f3efe6",
    webPreferences: {
      preload: join(import.meta.dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  await window.loadURL("study://app/index.html");
  await flush();
  setInterval(() => {
    void flush();
  }, 60_000);
}

app.on("window-all-closed", () => app.quit());
app.whenReady().then(main);
