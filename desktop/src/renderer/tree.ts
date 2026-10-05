export type Materia = {
  id: string;
  name: string;
  ramas: Rama[];
};

export type Rama = {
  id: string;
  name: string;
  temas: Tema[];
};

export type Tema = {
  id: string;
  name: string;
  priority: string;
  points: number;
  conocimientos: Conocimiento[];
};

export type Conocimiento = {
  id: string;
  title: string;
  explanation: string;
  example: string | null;
  link: string | null;
  archived: boolean;
  preguntas: Array<{ id: string; type: string; prompt: string }>;
  relaciones: Array<{ to_id: string; type: string }>;
  medios: Array<{ id: string; kind: string }>;
};

export type TreeActions = {
  createMateria(name: string): Promise<void>;
  createRama(materiaId: string, name: string): Promise<void>;
  createTema(ramaId: string, name: string, priority: string): Promise<void>;
  createConocimiento(temaId: string, title: string, explanation: string): Promise<void>;
  reorder(kind: "materia" | "rama" | "tema" | "conocimiento", parentId: string | null, orderedIds: string[]): Promise<void>;
  updateTema(id: string, priority: string): Promise<void>;
  openFicha(conocimiento: Conocimiento, materias: Materia[]): void;
};

export function findConocimiento(materias: Materia[], id: string): Conocimiento | null {
  for (const materia of materias) {
    for (const rama of materia.ramas) {
      for (const tema of rama.temas) {
        for (const conocimiento of tema.conocimientos) {
          if (conocimiento.id === id) return conocimiento;
        }
      }
    }
  }
  return null;
}

export function reorderIds(ids: string[], index: number, delta: number): string[] | null {
  const target = index + delta;
  if (target < 0 || target >= ids.length) return null;
  const next = [...ids];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function field(parent: HTMLElement, placeholder: string): HTMLInputElement {
  const input = document.createElement("input");
  input.placeholder = placeholder;
  parent.append(input);
  return input;
}

function button(parent: HTMLElement, label: string, onClick: () => void): void {
  const element = document.createElement("button");
  element.type = "button";
  element.textContent = label;
  element.addEventListener("click", onClick);
  parent.append(element);
}

type ReorderKind = "materia" | "rama" | "tema" | "conocimiento";

function moveControls(
  parent: HTMLElement,
  ids: string[],
  index: number,
  kind: ReorderKind,
  parentId: string | null,
  reorder: TreeActions["reorder"],
): void {
  const controls = document.createElement("span");
  controls.className = "inline";
  button(controls, "↑", () => {
    const next = reorderIds(ids, index, -1);
    if (next) void reorder(kind, parentId, next);
  });
  button(controls, "↓", () => {
    const next = reorderIds(ids, index, 1);
    if (next) void reorder(kind, parentId, next);
  });
  parent.append(controls);
}

export function mountTree(root: HTMLElement, materias: Materia[], actions: TreeActions): void {
  root.replaceChildren();
  const addMateria = document.createElement("form");
  addMateria.className = "inline";
  const materiaName = field(addMateria, "Nueva materia");
  button(addMateria, "Agregar materia", () => {
    if (materiaName.value.trim()) void actions.createMateria(materiaName.value.trim());
  });
  root.append(addMateria);

  const list = document.createElement("ol");
  list.className = "tree";
  const materiaIds = materias.map((materia) => materia.id);
  for (const [materiaIndex, materia] of materias.entries()) {
    const item = document.createElement("li");
    const title = document.createElement("h2");
    title.textContent = materia.name;
    item.append(title);
    moveControls(item, materiaIds, materiaIndex, "materia", null, actions.reorder);
    const addRama = document.createElement("form");
    addRama.className = "inline";
    const ramaName = field(addRama, "Nueva rama");
    button(addRama, "Agregar rama", () => {
      if (ramaName.value.trim()) void actions.createRama(materia.id, ramaName.value.trim());
    });
    item.append(addRama);

    const ramas = document.createElement("ol");
    const ramaIds = materia.ramas.map((rama) => rama.id);
    for (const [ramaIndex, rama] of materia.ramas.entries()) {
      const ramaItem = document.createElement("li");
      const ramaTitle = document.createElement("h3");
      ramaTitle.textContent = rama.name;
      ramaItem.append(ramaTitle);
      moveControls(ramaItem, ramaIds, ramaIndex, "rama", materia.id, actions.reorder);
      const addTema = document.createElement("form");
      addTema.className = "inline";
      const temaName = field(addTema, "Nuevo tema");
      const priority = document.createElement("select");
      for (const value of ["normal", "alta", "maxima"]) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        priority.append(option);
      }
      addTema.append(priority);
      button(addTema, "Agregar tema", () => {
        if (temaName.value.trim()) void actions.createTema(rama.id, temaName.value.trim(), priority.value);
      });
      ramaItem.append(addTema);

      const temas = document.createElement("ol");
      const temaIds = rama.temas.map((tema) => tema.id);
      for (const [temaIndex, tema] of rama.temas.entries()) {
        const temaItem = document.createElement("li");
        const temaHeader = document.createElement("div");
        temaHeader.className = "inline";
        const temaTitle = document.createElement("span");
        temaTitle.textContent = `${tema.name} · ${tema.points} pts`;
        const priority = document.createElement("select");
        for (const value of ["normal", "alta", "maxima"]) {
          const option = document.createElement("option");
          option.value = value;
          option.textContent = value;
          option.selected = value === tema.priority;
          priority.append(option);
        }
        priority.addEventListener("change", () => {
          void actions.updateTema(tema.id, priority.value);
        });
        temaHeader.append(temaTitle, priority);
        temaItem.append(temaHeader);
        moveControls(temaItem, temaIds, temaIndex, "tema", rama.id, actions.reorder);
        const addConocimiento = document.createElement("form");
        addConocimiento.className = "inline";
        const conocimientoTitle = field(addConocimiento, "Título");
        const explanation = field(addConocimiento, "Explicación");
        button(addConocimiento, "Agregar conocimiento", () => {
          if (conocimientoTitle.value.trim() && explanation.value.trim()) {
            void actions.createConocimiento(tema.id, conocimientoTitle.value.trim(), explanation.value.trim());
          }
        });
        temaItem.append(addConocimiento);
        const conocimientos = document.createElement("ul");
        const conocimientoIds = tema.conocimientos.map((conocimiento) => conocimiento.id);
        for (const [conocimientoIndex, conocimiento] of tema.conocimientos.entries()) {
          const row = document.createElement("li");
          const open = document.createElement("button");
          open.type = "button";
          open.textContent = conocimiento.archived ? `${conocimiento.title} (archivado)` : conocimiento.title;
          open.addEventListener("click", () => actions.openFicha(conocimiento, materias));
          row.append(open);
          moveControls(row, conocimientoIds, conocimientoIndex, "conocimiento", tema.id, actions.reorder);
          conocimientos.append(row);
        }
        temaItem.append(conocimientos);
        temas.append(temaItem);
      }
      ramaItem.append(temas);
      ramas.append(ramaItem);
    }
    item.append(ramas);
    list.append(item);
  }
  root.append(list);
}
