import type { Conocimiento, Materia } from "./tree.ts";

export type QuestionDraft =
  | { type: "boolean"; prompt: string; correct: boolean }
  | { type: "written"; prompt: string; expectedAnswer: string }
  | { type: "multiple_choice"; prompt: string; options: Array<{ text: string; kind: string }> };

export function oneComplete(options: Array<{ kind: string }>): boolean {
  return options.filter((option) => option.kind === "completa").length === 1;
}

export function mediaKindFromFile(file: { type: string }): "image" | "video" | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return null;
}

export type FichaActions = {
  update(id: string, body: { title: string; explanation: string; example: string | null; link: string | null }): Promise<void>;
  archive(id: string): Promise<void>;
  restore(id: string): Promise<void>;
  saveQuestion(id: string, question: QuestionDraft): Promise<void>;
  saveRelation(fromId: string, toId: string, type: string): Promise<void>;
  uploadMedia(id: string, file: File): Promise<void>;
  previewMedia(id: string): Promise<string | null>;
};

function labeled(parent: HTMLElement, label: string, value: string, multiline = false): HTMLInputElement | HTMLTextAreaElement {
  const wrapper = document.createElement("label");
  wrapper.textContent = label;
  const field = multiline ? document.createElement("textarea") : document.createElement("input");
  field.value = value;
  wrapper.append(field);
  parent.append(wrapper);
  return field;
}

export function mountFicha(
  root: HTMLElement,
  conocimiento: Conocimiento,
  materias: Materia[],
  actions: FichaActions,
  notice: HTMLElement,
): void {
  root.replaceChildren();
  const form = document.createElement("form");
  const title = labeled(form, "Título", conocimiento.title);
  const explanation = labeled(form, "Explicación", conocimiento.explanation, true);
  const example = labeled(form, "Ejemplo", conocimiento.example ?? "");
  const link = labeled(form, "Link", conocimiento.link ?? "");
  const save = document.createElement("button");
  save.type = "submit";
  save.textContent = "Guardar ficha";
  form.append(save);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void actions.update(conocimiento.id, {
      title: title.value,
      explanation: explanation.value,
      example: example.value === "" ? null : example.value,
      link: link.value === "" ? null : link.value,
    });
  });
  root.append(form);

  const media = document.createElement("section");
  const mediaHeading = document.createElement("h2");
  mediaHeading.textContent = "Medios";
  media.append(mediaHeading);
  const mediaList = document.createElement("div");
  media.append(mediaList);
  for (const medio of conocimiento.medios ?? []) {
    const row = document.createElement("p");
    row.textContent = `${medio.kind} · ${medio.id.slice(0, 8)}… `;
    const preview = document.createElement("button");
    preview.type = "button";
    preview.textContent = "Ver";
    preview.addEventListener("click", () => {
      void actions.previewMedia(medio.id).then((url) => {
        if (!url) {
          notice.textContent = "No se pudo cargar el medio.";
          return;
        }
        const viewer = document.createElement(medio.kind === "video" ? "video" : "img");
        if (viewer instanceof HTMLVideoElement) {
          viewer.src = url;
          viewer.controls = true;
        } else {
          viewer.src = url;
          viewer.alt = "Medio adjunto";
        }
        mediaList.append(viewer);
      });
    });
    row.append(preview);
    mediaList.append(row);
  }
  const picker = document.createElement("input");
  picker.type = "file";
  picker.accept = "image/*,video/*";
  const upload = document.createElement("button");
  upload.type = "button";
  upload.textContent = "Adjuntar medio";
  upload.addEventListener("click", () => {
    const file = picker.files?.[0];
    if (!file) {
      notice.textContent = "Elegí una imagen o un video.";
      return;
    }
    const kind = mediaKindFromFile(file);
    if (!kind) {
      notice.textContent = "Solo se admiten imágenes y videos.";
      return;
    }
    notice.textContent = "";
    void actions.uploadMedia(conocimiento.id, file).catch((error: unknown) => {
      notice.textContent =
        error instanceof Error && error.message === "tamano"
          ? "El archivo supera el tamaño permitido."
          : "No se pudo adjuntar el medio.";
    });
  });
  media.append(picker, upload);
  root.append(media);

  const questions = document.createElement("section");
  const heading = document.createElement("h2");
  heading.textContent = "Preguntas";
  questions.append(heading);
  const existing = document.createElement("ul");
  for (const pregunta of conocimiento.preguntas) {
    const item = document.createElement("li");
    item.textContent = `${pregunta.type}: ${pregunta.prompt}`;
    existing.append(item);
  }
  questions.append(existing);

  const booleanPrompt = labeled(questions, "Verdadero o falso", "");
  const correct = document.createElement("input");
  correct.type = "checkbox";
  questions.append(correct);
  const addBoolean = document.createElement("button");
  addBoolean.type = "button";
  addBoolean.textContent = "Agregar verdadero o falso";
  addBoolean.addEventListener("click", () => {
    if (!booleanPrompt.value.trim()) return;
    void actions.saveQuestion(conocimiento.id, {
      type: "boolean",
      prompt: booleanPrompt.value.trim(),
      correct: correct.checked,
    });
  });
  questions.append(addBoolean);

  const writtenPrompt = labeled(questions, "Escrita", "");
  const expected = labeled(questions, "Respuesta esperada", "");
  const addWritten = document.createElement("button");
  addWritten.type = "button";
  addWritten.textContent = "Agregar escrita";
  addWritten.addEventListener("click", () => {
    if (!writtenPrompt.value.trim() || !expected.value.trim()) return;
    void actions.saveQuestion(conocimiento.id, {
      type: "written",
      prompt: writtenPrompt.value.trim(),
      expectedAnswer: expected.value.trim(),
    });
  });
  questions.append(addWritten);

  const choicePrompt = labeled(questions, "Opción múltiple", "");
  const options: Array<{ text: HTMLInputElement; kind: HTMLSelectElement }> = [];
  for (let index = 0; index < 3; index += 1) {
    const row = document.createElement("div");
    row.className = "inline";
    const text = document.createElement("input");
    text.placeholder = `Opción ${index + 1}`;
    const kind = document.createElement("select");
    for (const value of ["falsa", "verdadera", "completa"]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      kind.append(option);
    }
    row.append(text, kind);
    questions.append(row);
    options.push({ text, kind });
  }
  const addChoice = document.createElement("button");
  addChoice.type = "button";
  addChoice.textContent = "Agregar opción múltiple";
  addChoice.addEventListener("click", () => {
    const payload = options
      .filter((option) => option.text.value.trim())
      .map((option) => ({ text: option.text.value.trim(), kind: option.kind.value }));
    if (!oneComplete(payload)) {
      notice.textContent = "Tiene que haber exactamente una opción completa.";
      return;
    }
    notice.textContent = "";
    void actions.saveQuestion(conocimiento.id, {
      type: "multiple_choice",
      prompt: choicePrompt.value.trim(),
      options: payload,
    });
  });
  questions.append(addChoice);
  root.append(questions);

  const relations = document.createElement("section");
  const relationHeading = document.createElement("h2");
  relationHeading.textContent = "Relación";
  relations.append(relationHeading);
  const target = document.createElement("select");
  const kind = document.createElement("select");
  for (const type of ["prerrequisito", "profundiza", "ejemplo", "contradice"]) {
    const option = document.createElement("option");
    option.value = type;
    option.textContent = type;
    kind.append(option);
  }
  for (const materia of materias) {
    for (const rama of materia.ramas) {
      for (const tema of rama.temas) {
        for (const other of tema.conocimientos) {
          if (other.id === conocimiento.id) continue;
          const option = document.createElement("option");
          option.value = other.id;
          option.textContent = other.title;
          target.append(option);
        }
      }
    }
  }
  const relate = document.createElement("button");
  relate.type = "button";
  relate.textContent = "Guardar relación";
  relate.addEventListener("click", () => {
    if (!target.value) return;
    void actions.saveRelation(conocimiento.id, target.value, kind.value);
  });
  relations.append(target, kind, relate);
  root.append(relations);

  const archive = document.createElement("button");
  archive.type = "button";
  archive.textContent = conocimiento.archived ? "Restaurar" : "Archivar";
  archive.addEventListener("click", () => {
    void (conocimiento.archived ? actions.restore(conocimiento.id) : actions.archive(conocimiento.id));
  });
  root.append(archive);
}
