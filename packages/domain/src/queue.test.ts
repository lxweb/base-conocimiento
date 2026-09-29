import assert from "node:assert/strict";
import test from "node:test";
import { selectQueue, type QueueCandidate } from "./queue.ts";

function candidate(partial: Partial<QueueCandidate> & Pick<QueueCandidate, "conocimientoId">): QueueCandidate {
  return {
    priority: "normal",
    consecutiveFullSuccesses: 1,
    dueOn: "2026-09-28",
    archived: false,
    hasQuestion: true,
    materiaPosition: 1,
    ramaPosition: 1,
    temaPosition: 1,
    conocimientoPosition: 1,
    ...partial,
  };
}

test("excluye archivados, sin preguntas y los que todavía no vencen", () => {
  const ids = selectQueue(
    [
      candidate({ conocimientoId: "archivado", archived: true }),
      candidate({ conocimientoId: "sin-pregunta", hasQuestion: false }),
      candidate({ conocimientoId: "futuro", dueOn: "2026-09-29" }),
      candidate({ conocimientoId: "hoy" }),
    ],
    "2026-09-28",
  );
  assert.deepEqual(ids, ["hoy"]);
});

test("toma como máximo cinco nuevos y no rellena con más nuevos", () => {
  const nuevos = Array.from({ length: 8 }, (_, index) =>
    candidate({
      conocimientoId: `nuevo-${index}`,
      consecutiveFullSuccesses: 0,
      dueOn: null,
      conocimientoPosition: index + 1,
    }),
  );
  const revisados = [
    candidate({ conocimientoId: "rev-1", conocimientoPosition: 1 }),
    candidate({ conocimientoId: "rev-2", conocimientoPosition: 2 }),
  ];
  const ids = selectQueue([...nuevos, ...revisados], "2026-09-28");
  assert.equal(ids.length, 7);
  assert.deepEqual(ids.slice(0, 5), ["nuevo-0", "nuevo-1", "nuevo-2", "nuevo-3", "nuevo-4"]);
  assert.deepEqual(ids.slice(5), ["rev-1", "rev-2"]);
});

test("llena hasta veinte con vencidos cuando hay menos de cinco nuevos", () => {
  const nuevos = [candidate({ conocimientoId: "nuevo", consecutiveFullSuccesses: 0, dueOn: null })];
  const revisados = Array.from({ length: 20 }, (_, index) =>
    candidate({ conocimientoId: `rev-${index}`, conocimientoPosition: index + 1 }),
  );
  const ids = selectQueue([...nuevos, ...revisados], "2026-09-28");
  assert.equal(ids.length, 20);
  assert.equal(ids[0], "nuevo");
  assert.equal(ids.filter((id) => id.startsWith("rev-")).length, 19);
});

test("ordena por prioridad, atraso y posición manual", () => {
  const ids = selectQueue(
    [
      candidate({
        conocimientoId: "normal-viejo",
        priority: "normal",
        dueOn: "2026-09-01",
        materiaPosition: 1,
      }),
      candidate({
        conocimientoId: "alta-reciente",
        priority: "alta",
        dueOn: "2026-09-27",
        materiaPosition: 2,
      }),
      candidate({
        conocimientoId: "maxima-vacio",
        priority: "maxima",
        dueOn: null,
        materiaPosition: 3,
      }),
      candidate({
        conocimientoId: "alta-mas-viejo",
        priority: "alta",
        dueOn: "2026-09-20",
        materiaPosition: 2,
        ramaPosition: 1,
        temaPosition: 2,
      }),
      candidate({
        conocimientoId: "alta-misma-fecha-antes",
        priority: "alta",
        dueOn: "2026-09-20",
        materiaPosition: 2,
        ramaPosition: 1,
        temaPosition: 1,
      }),
    ],
    "2026-09-28",
  );
  assert.deepEqual(ids, [
    "maxima-vacio",
    "alta-misma-fecha-antes",
    "alta-mas-viejo",
    "alta-reciente",
    "normal-viejo",
  ]);
});
