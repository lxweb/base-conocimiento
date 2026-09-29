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
};

export type TreeActions = {
  createMateria(name: string): Promise<void>;
  createRama(materiaId: string, name: string): Promise<void>;
  createTema(ramaId: string, name: string, priority: string): Promise<void>;
  createConocimiento(temaId: string, title: string, explanation: string): Promise<void>;
  openFicha(conocimiento: Conocimiento, materias: Materia[]): void;
};

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
  for (const materia of materias) {
    const item = document.createElement("li");
    const title = document.createElement("h2");
    title.textContent = materia.name;
    item.append(title);
    const addRama = document.createElement("form");
    addRama.className = "inline";
    const ramaName = field(addRama, "Nueva rama");
    button(addRama, "Agregar rama", () => {
      if (ramaName.value.trim()) void actions.createRama(materia.id, ramaName.value.trim());
    });
    item.append(addRama);

    const ramas = document.createElement("ol");
    for (const rama of materia.ramas) {
      const ramaItem = document.createElement("li");
      const ramaTitle = document.createElement("h3");
      ramaTitle.textContent = rama.name;
      ramaItem.append(ramaTitle);
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
      for (const tema of rama.temas) {
        const temaItem = document.createElement("li");
        const temaTitle = document.createElement("p");
        temaTitle.textContent = `${tema.name} · ${tema.priority} · ${tema.points} pts`;
        temaItem.append(temaTitle);
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
        for (const conocimiento of tema.conocimientos) {
          const row = document.createElement("li");
          const open = document.createElement("button");
          open.type = "button";
          open.textContent = conocimiento.archived ? `${conocimiento.title} (archivado)` : conocimiento.title;
          open.addEventListener("click", () => actions.openFicha(conocimiento, materias));
          row.append(open);
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
