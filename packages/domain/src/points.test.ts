import assert from "node:assert/strict";
import test from "node:test";
import {
  applyPoints,
  gradeBoolean,
  gradeOption,
  gradeWritten,
  questionTypeForPoints,
} from "./points.ts";

test("el tipo pedido sigue los tramos de puntos", () => {
  assert.equal(questionTypeForPoints(0), "boolean");
  assert.equal(questionTypeForPoints(7), "boolean");
  assert.equal(questionTypeForPoints(8), "multiple_choice");
  assert.equal(questionTypeForPoints(23), "multiple_choice");
  assert.equal(questionTypeForPoints(24), "written");
});

test("un acierto suma uno, un error resta uno y el parcial no mueve", () => {
  assert.equal(applyPoints(5, "pleno"), 6);
  assert.equal(applyPoints(5, "error"), 4);
  assert.equal(applyPoints(5, "parcial"), 5);
});

test("un error en cero deja el puntaje en cero", () => {
  assert.equal(applyPoints(0, "error"), 0);
});

test("clasifica verdadero o falso, opción múltiple y escrita", () => {
  assert.equal(gradeBoolean(true, true), "pleno");
  assert.equal(gradeBoolean(true, false), "error");
  assert.equal(gradeOption("completa"), "pleno");
  assert.equal(gradeOption("verdadera"), "parcial");
  assert.equal(gradeOption("falsa"), "error");
  assert.equal(gradeWritten(true), "pleno");
  assert.equal(gradeWritten(false), "error");
});
