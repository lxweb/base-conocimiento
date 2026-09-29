import assert from "node:assert/strict";
import test from "node:test";
import { presentItem, toSessionItem, type SessionItem } from "../src/renderer/cola.ts";

const item: SessionItem = {
  id: "item-1",
  snapshot: {
    question: {
      id: "preg-1",
      type: "written",
      prompt: "¿Qué es la inercia?",
      correct: null,
      expectedAnswer: "Conserva el estado",
      options: [],
    },
    knowledge: {
      title: "Inercia",
      explanation: "Un cuerpo conserva su estado.",
      example: null,
      link: null,
    },
  },
};

test("antes de responder solo muestra el enunciado", () => {
  const view = presentItem(item, null);
  assert.equal(view.prompt, "¿Qué es la inercia?");
  assert.equal(view.explanation, null);
  assert.equal(view.expectedAnswer, null);
  assert.equal(view.readyToEnqueue, false);
});

test("la escrita no se encola hasta marcar si equivale", () => {
  const typed = presentItem(item, { writtenText: "sigue igual", equivalent: null });
  assert.equal(typed.explanation, "Un cuerpo conserva su estado.");
  assert.equal(typed.expectedAnswer, "Conserva el estado");
  assert.equal(typed.readyToEnqueue, false);
  const marked = presentItem(item, { writtenText: "sigue igual", equivalent: true });
  assert.equal(marked.readyToEnqueue, true);
});

test("verdadero o falso se puede encolar en cuanto se elige", () => {
  const booleanItem: SessionItem = {
    ...item,
    snapshot: {
      ...item.snapshot,
      question: { ...item.snapshot.question, type: "boolean", correct: true, expectedAnswer: null },
    },
  };
  const view = presentItem(booleanItem, { booleanChoice: false });
  assert.equal(view.readyToEnqueue, true);
  assert.equal(view.explanation, "Un cuerpo conserva su estado.");
});

test("la copia del servidor usa conocimiento y se lee como knowledge", () => {
  const adapted = toSessionItem({
    id: "item-1",
    snapshot: {
      question: item.snapshot.question,
      conocimiento: item.snapshot.knowledge,
    },
  });
  const view = presentItem(adapted, null);
  assert.equal(view.prompt, "¿Qué es la inercia?");
  assert.equal(view.explanation, null);
});
