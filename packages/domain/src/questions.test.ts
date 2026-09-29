import assert from "node:assert/strict";
import test from "node:test";
import { chooseQuestion, type QuestionRef } from "./questions.ts";

const booleanQ = (id: string, lastAskedOn: string | null): QuestionRef => ({
  id,
  type: "boolean",
  lastAskedOn,
});

test("sin preguntas no elige nada", () => {
  assert.equal(chooseQuestion(0, []), null);
});

test("respeta el tipo del nivel cuando existe", () => {
  const questions = [
    booleanQ("vf", null),
    { id: "mc", type: "multiple_choice" as const, lastAskedOn: null },
    { id: "escrita", type: "written" as const, lastAskedOn: null },
  ];
  assert.equal(chooseQuestion(0, questions)?.id, "vf");
  assert.equal(chooseQuestion(8, questions)?.id, "mc");
  assert.equal(chooseQuestion(24, questions)?.id, "escrita");
});

test("si falta el tipo del nivel usa el más avanzado disponible", () => {
  assert.equal(chooseQuestion(24, [booleanQ("solo-vf", null)])?.id, "solo-vf");
  assert.equal(
    chooseQuestion(0, [{ id: "solo-escrita", type: "written", lastAskedOn: null }])?.id,
    "solo-escrita",
  );
  assert.equal(
    chooseQuestion(24, [
      booleanQ("vf", null),
      { id: "mc", type: "multiple_choice", lastAskedOn: null },
    ])?.id,
    "mc",
  );
});

test("dentro del tipo elige la nunca usada y, si no, la más antigua", () => {
  const questions = [
    booleanQ("vieja", "2026-09-01"),
    booleanQ("nueva", null),
    booleanQ("media", "2026-09-10"),
  ];
  assert.equal(chooseQuestion(0, questions)?.id, "nueva");
  assert.equal(
    chooseQuestion(0, [booleanQ("vieja", "2026-09-01"), booleanQ("media", "2026-09-10")])?.id,
    "vieja",
  );
});

test("empate de fecha se rompe por id", () => {
  assert.equal(
    chooseQuestion(0, [booleanQ("b", "2026-09-01"), booleanQ("a", "2026-09-01")])?.id,
    "a",
  );
});
