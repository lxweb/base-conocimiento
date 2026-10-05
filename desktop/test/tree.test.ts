import assert from "node:assert/strict";
import test from "node:test";
import { findConocimiento, reorderIds, type Materia } from "../src/renderer/tree.ts";

const tree: Materia[] = [
  {
    id: "m1",
    name: "M",
    ramas: [
      {
        id: "r1",
        name: "R",
        temas: [
          {
            id: "t1",
            name: "T",
            priority: "normal",
            points: 0,
            conocimientos: [
              {
                id: "c1",
                title: "Uno",
                explanation: "E",
                example: null,
                link: null,
                archived: false,
                preguntas: [],
                relaciones: [],
                medios: [],
              },
            ],
          },
        ],
      },
    ],
  },
];

test("reorderIds intercambia vecinos", () => {
  assert.deepEqual(reorderIds(["a", "b", "c"], 1, -1), ["b", "a", "c"]);
  assert.deepEqual(reorderIds(["a", "b", "c"], 1, 1), ["a", "c", "b"]);
  assert.equal(reorderIds(["a"], 0, -1), null);
});

test("findConocimiento localiza una ficha en el árbol", () => {
  assert.equal(findConocimiento(tree, "c1")?.title, "Uno");
  assert.equal(findConocimiento(tree, "missing"), null);
});
