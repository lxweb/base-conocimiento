import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("desktop", {
  login: (password) => ipcRenderer.invoke("login", password),
  loadTree: () => ipcRenderer.invoke("load-tree"),
  createMateria: (name) => ipcRenderer.invoke("create-materia", name),
  createRama: (materiaId, name) => ipcRenderer.invoke("create-rama", materiaId, name),
  createTema: (ramaId, name, priority) => ipcRenderer.invoke("create-tema", ramaId, name, priority),
  createConocimiento: (temaId, body) => ipcRenderer.invoke("create-conocimiento", temaId, body),
  updateConocimiento: (id, body) => ipcRenderer.invoke("update-conocimiento", id, body),
  archive: (id) => ipcRenderer.invoke("archive", id),
  restore: (id) => ipcRenderer.invoke("restore", id),
  saveQuestion: (conocimientoId, body) => ipcRenderer.invoke("save-question", conocimientoId, body),
  saveRelation: (fromId, toId, type) => ipcRenderer.invoke("save-relation", fromId, toId, type),
  reorder: (kind, parentId, orderedIds) => ipcRenderer.invoke("reorder", kind, parentId, orderedIds),
  updateTema: (id, priority) => ipcRenderer.invoke("update-tema", id, priority),
  uploadMedia: async (id, file) => {
    const bytes = await file.arrayBuffer();
    return ipcRenderer.invoke("upload-media", id, { name: file.name, type: file.type, bytes });
  },
  previewMedia: (id) => ipcRenderer.invoke("preview-media", id),
  openSession: () => ipcRenderer.invoke("open-session"),
  enqueue: (answer) => ipcRenderer.invoke("enqueue", answer),
  notifyOnline: () => ipcRenderer.send("online"),
  onNeedsLogin: (callback) => {
    ipcRenderer.on("needs-login", () => callback());
  },
});
