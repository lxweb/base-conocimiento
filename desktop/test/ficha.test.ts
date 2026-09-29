import assert from "node:assert/strict";
import test from "node:test";
import { oneComplete } from "../src/renderer/ficha.ts";

test("la opción múltiple solo se guarda con exactamente una completa", () => {
  assert.equal(oneComplete([{ kind: "falsa" }, { kind: "verdadera" }]), false);
  assert.equal(oneComplete([{ kind: "completa" }, { kind: "completa" }]), false);
  assert.equal(oneComplete([{ kind: "falsa" }, { kind: "completa" }]), true);
});
