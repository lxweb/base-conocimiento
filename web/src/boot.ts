import { presentItem, toSessionItem, type Draft } from "../../desktop/src/renderer/cola.ts";
import { mountFicha } from "../../desktop/src/renderer/ficha.ts";
import { mountLogin } from "../../desktop/src/renderer/login.ts";
import { findConocimiento, mountTree, type Conocimiento, type Materia } from "../../desktop/src/renderer/tree.ts";
import { ApiError } from "../../desktop/src/api.ts";
import { createWebClient, type WebClient } from "./client.ts";

type SessionItemRaw = {
  id: string;
  snapshot: {
    question: {
      id: string;
      type: "boolean" | "multiple_choice" | "written";
      prompt: string;
      correct: boolean | null;
      expectedAnswer: string | null;
      options: Array<{ id: string; text: string; kind: "falsa" | "verdadera" | "completa" }>;
    };
    conocimiento?: {
      title: string;
      explanation: string;
      example: string | null;
      link: string | null;
    };
    knowledge?: {
      title: string;
      explanation: string;
      example: string | null;
      link: string | null;
    };
  };
};

declare global {
  interface Window {
    desktop: WebClient;
  }
}

const client = createWebClient();
window.desktop = client;

const screens = ["login", "arbol", "ficha", "cola"] as const;

function show(name: (typeof screens)[number]): void {
  for (const screen of screens) {
    document.getElementById(screen)?.toggleAttribute("hidden", screen !== name);
  }
  document.querySelector("header")?.toggleAttribute("hidden", name === "login");
}

async function refreshTree(): Promise<void> {
  const materias = (await client.loadTree()) as Materia[];
  const root = document.querySelector("#arbol .tree-root");
  if (!(root instanceof HTMLElement)) return;
  mountTree(root, materias, {
    createMateria: async (name) => {
      await client.createMateria(name);
      await refreshTree();
    },
    createRama: async (materiaId, name) => {
      await client.createRama(materiaId, name);
      await refreshTree();
    },
    createTema: async (ramaId, name, priority) => {
      await client.createTema(ramaId, name, priority);
      await refreshTree();
    },
    createConocimiento: async (temaId, title, explanation) => {
      await client.createConocimiento(temaId, { title, explanation });
      await refreshTree();
    },
    reorder: async (kind, parentId, orderedIds) => {
      await client.reorder(kind, parentId, orderedIds);
      await refreshTree();
    },
    updateTema: async (id, priority) => {
      await client.updateTema(id, priority);
      await refreshTree();
    },
    openFicha: (conocimiento, tree) => openFicha(conocimiento, tree),
  });
}

function openFicha(conocimiento: Conocimiento, materias: Materia[]): void {
  const root = document.querySelector("#ficha .ficha-root");
  const notice = document.querySelector("#ficha .notice");
  if (!(root instanceof HTMLElement) || !(notice instanceof HTMLElement)) return;
  show("ficha");
  mountFicha(root, conocimiento, materias, {
    update: async (id, body) => {
      await client.updateConocimiento(id, body);
      await refreshTree();
    },
    archive: async (id) => {
      await client.archive(id);
      await refreshTree();
      show("arbol");
    },
    restore: async (id) => {
      await client.restore(id);
      await refreshTree();
      show("arbol");
    },
    saveQuestion: async (id, question) => {
      await client.saveQuestion(id, question);
      await refreshTree();
      show("arbol");
    },
    saveRelation: async (fromId, toId, type) => {
      await client.saveRelation(fromId, toId, type);
      notice.textContent = "Relación guardada.";
    },
    uploadMedia: async (id, file) => {
      try {
        await client.uploadMedia(id, file);
      } catch (error) {
        if (error instanceof ApiError && error.status === 413) throw new Error("tamano");
        throw error;
      }
      const materias = (await client.loadTree()) as Materia[];
      const fresh = findConocimiento(materias, id);
      if (fresh) openFicha(fresh, materias);
    },
    previewMedia: (id) => client.previewMedia(id),
  }, notice);
}

function paintQueue(host: HTMLElement, items: SessionItemRaw[]): void {
  host.replaceChildren();
  let index = 0;
  let draft: Draft | null = null;
  let sent = false;

  const prompt = document.createElement("p");
  prompt.className = "prompt";
  const backing = document.createElement("article");
  backing.hidden = true;
  const title = document.createElement("h2");
  const explanation = document.createElement("p");
  const example = document.createElement("p");
  const link = document.createElement("a");
  const expected = document.createElement("p");
  backing.append(title, explanation, example, expected, link);
  const controls = document.createElement("div");
  controls.className = "controls";
  const status = document.createElement("p");
  status.className = "notice";
  host.append(prompt, controls, backing, status);

  function render(): void {
    const raw = items[index];
    controls.replaceChildren();
    if (!raw) {
      prompt.textContent = "No quedan preguntas en la sesión de hoy.";
      backing.hidden = true;
      return;
    }
    const item = toSessionItem(raw);
    const view = presentItem(item, draft);
    prompt.textContent = view.prompt;
    backing.hidden = view.explanation === null;
    title.textContent = view.title ?? "";
    explanation.textContent = view.explanation ?? "";
    example.textContent = item.snapshot.knowledge.example ?? "";
    example.hidden = view.explanation === null || !item.snapshot.knowledge.example;
    expected.textContent = view.expectedAnswer ? `Respuesta esperada: ${view.expectedAnswer}` : "";
    expected.hidden = view.expectedAnswer === null;
    if (item.snapshot.knowledge.link && view.explanation) {
      link.href = item.snapshot.knowledge.link;
      link.textContent = item.snapshot.knowledge.link;
      link.hidden = false;
    } else {
      link.hidden = true;
    }

    const question = item.snapshot.question;
    if (!draft && question.type === "boolean") {
      for (const choice of [true, false]) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = choice ? "Verdadero" : "Falso";
        button.addEventListener("click", () => {
          draft = { booleanChoice: choice };
          render();
          void maybeEnqueue();
        });
        controls.append(button);
      }
    }
    if (!draft && question.type === "multiple_choice") {
      for (const option of question.options) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = option.text;
        button.addEventListener("click", () => {
          draft = { optionId: option.id };
          render();
          void maybeEnqueue();
        });
        controls.append(button);
      }
    }
    if (question.type === "written" && (!draft || !("writtenText" in draft))) {
      const input = document.createElement("textarea");
      const send = document.createElement("button");
      send.type = "button";
      send.textContent = "Responder";
      send.addEventListener("click", () => {
        draft = { writtenText: input.value, equivalent: null };
        render();
      });
      controls.append(input, send);
    }
    if (draft && "writtenText" in draft && draft.equivalent === null) {
      for (const equivalent of [true, false]) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = equivalent ? "Equivale" : "No equivale";
        button.addEventListener("click", () => {
          if (!draft || !("writtenText" in draft)) return;
          draft = { writtenText: draft.writtenText, equivalent };
          render();
          void maybeEnqueue();
        });
        controls.append(button);
      }
    }
    if (sent) {
      const next = document.createElement("button");
      next.type = "button";
      next.textContent = "Siguiente";
      next.addEventListener("click", () => {
        draft = null;
        sent = false;
        index += 1;
        status.textContent = "";
        render();
      });
      controls.append(next);
    }
  }

  async function maybeEnqueue(): Promise<void> {
    const raw = items[index];
    if (!raw || !draft || sent) return;
    const item = toSessionItem(raw);
    if (!presentItem(item, draft).readyToEnqueue) return;
    sent = true;
    const current = draft;
    const result = await client.enqueue({
      id: crypto.randomUUID(),
      sessionItemId: item.id,
      answeredAt: new Date().toISOString(),
      booleanChoice: "booleanChoice" in current ? current.booleanChoice : null,
      optionId: "optionId" in current ? current.optionId : null,
      writtenText: "writtenText" in current ? current.writtenText : null,
      equivalent: "equivalent" in current ? current.equivalent : null,
    });
    if (result.needsLogin) {
      show("login");
      return;
    }
    status.textContent = "Respuesta enviada.";
    render();
  }

  render();
}

async function openCola(): Promise<void> {
  const result = await client.openSession();
  if (result.needsLogin) {
    show("login");
    return;
  }
  const host = document.querySelector("#cola .cola-root");
  if (!(host instanceof HTMLElement)) return;
  show("cola");
  if ("error" in result && result.error) {
    host.textContent = "No hay una sesión guardada para hoy y el servidor no responde.";
    return;
  }
  const session = result.session as { items?: SessionItemRaw[] };
  paintQueue(host, session.items ?? []);
}

const loginForm = document.querySelector("#login form");
const loginMessage = document.querySelector("#login .notice");
if (loginForm instanceof HTMLFormElement && loginMessage instanceof HTMLElement) {
  mountLogin(loginForm, loginMessage, (password) => client.login(password), () => {
    void refreshTree().then(() => show("arbol"));
  });
}

document.querySelector("#nav-arbol")?.addEventListener("click", () => {
  void refreshTree().then(() => show("arbol"));
});
document.querySelector("#nav-cola")?.addEventListener("click", () => {
  void openCola();
});

client.onNeedsLogin(() => show("login"));
client.startBackgroundSync();

if (localStorage.getItem("bc-token")) {
  void client.notifyOnline().then(() => refreshTree()).then(() => show("arbol"));
} else {
  show("login");
}
