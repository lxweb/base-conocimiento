import assert from "node:assert/strict";
import test from "node:test";
import { mediaKindFromFile, oneComplete } from "../src/renderer/ficha.ts";

test("la opción múltiple solo se guarda con exactamente una completa", () => {
  assert.equal(oneComplete([{ kind: "falsa" }, { kind: "verdadera" }]), false);
  assert.equal(oneComplete([{ kind: "completa" }, { kind: "completa" }]), false);
  assert.equal(oneComplete([{ kind: "falsa" }, { kind: "completa" }]), true);
});

test("mediaKindFromFile distingue imagen y video", () => {
  assert.equal(mediaKindFromFile({ type: "image/png" }), "image");
  assert.equal(mediaKindFromFile({ type: "video/mp4" }), "video");
  assert.equal(mediaKindFromFile({ type: "application/pdf" }), null);
});
