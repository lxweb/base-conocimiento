import assert from "node:assert/strict";
import test from "node:test";
import { effectiveIntervalDays, nextSchedule, type Schedule } from "./schedule.ts";

const fresh: Schedule = {
  consecutiveFullSuccesses: 0,
  baseIntervalDays: 0,
  dueOn: null,
  hadFullSuccess: false,
};

test("los tres primeros aciertos plenos usan 1, 3 y 7 días", () => {
  const first = nextSchedule({
    schedule: fresh,
    outcome: "pleno",
    priority: "normal",
    sessionDate: "2026-09-28",
  });
  assert.deepEqual(first, {
    consecutiveFullSuccesses: 1,
    baseIntervalDays: 1,
    dueOn: "2026-09-29",
    hadFullSuccess: true,
  });

  const second = nextSchedule({
    schedule: first,
    outcome: "pleno",
    priority: "normal",
    sessionDate: "2026-09-29",
  });
  assert.equal(second.baseIntervalDays, 3);
  assert.equal(second.dueOn, "2026-10-02");

  const third = nextSchedule({
    schedule: second,
    outcome: "pleno",
    priority: "normal",
    sessionDate: "2026-10-02",
  });
  assert.equal(third.baseIntervalDays, 7);
  assert.equal(third.consecutiveFullSuccesses, 3);
});

test("desde el cuarto acierto multiplica el intervalo base por 2,5", () => {
  const afterThird: Schedule = {
    consecutiveFullSuccesses: 3,
    baseIntervalDays: 7,
    dueOn: "2026-10-09",
    hadFullSuccess: true,
  };
  const fourth = nextSchedule({
    schedule: afterThird,
    outcome: "pleno",
    priority: "normal",
    sessionDate: "2026-10-09",
  });
  assert.equal(fourth.baseIntervalDays, 18);
  assert.equal(fourth.dueOn, "2026-10-27");

  const fifth = nextSchedule({
    schedule: fourth,
    outcome: "pleno",
    priority: "normal",
    sessionDate: "2026-10-27",
  });
  assert.equal(fifth.baseIntervalDays, 45);

  const sixth = nextSchedule({
    schedule: fifth,
    outcome: "pleno",
    priority: "normal",
    sessionDate: "2026-10-27",
  });
  assert.equal(sixth.baseIntervalDays, 113);
});

test("la prioridad acorta el plazo efectivo y el mínimo es un día", () => {
  assert.equal(effectiveIntervalDays(7, "alta"), 5);
  assert.equal(effectiveIntervalDays(3, "maxima"), 2);
  assert.equal(effectiveIntervalDays(1, "maxima"), 1);
  assert.equal(effectiveIntervalDays(1, "alta"), 1);
});

test("un acierto pleno guarda el intervalo base sin el factor y vence según la prioridad del momento", () => {
  const schedule: Schedule = {
    consecutiveFullSuccesses: 2,
    baseIntervalDays: 3,
    dueOn: "2026-10-01",
    hadFullSuccess: true,
  };
  const next = nextSchedule({
    schedule,
    outcome: "pleno",
    priority: "alta",
    sessionDate: "2026-10-01",
  });
  assert.equal(next.baseIntervalDays, 7);
  assert.equal(next.dueOn, "2026-10-06");
  assert.equal(next.hadFullSuccess, true);
});

test("un error reinicia aciertos e intervalo base a un día", () => {
  const schedule: Schedule = {
    consecutiveFullSuccesses: 4,
    baseIntervalDays: 18,
    dueOn: "2026-11-01",
    hadFullSuccess: true,
  };
  const next = nextSchedule({
    schedule,
    outcome: "error",
    priority: "maxima",
    sessionDate: "2026-10-01",
  });
  assert.deepEqual(next, {
    consecutiveFullSuccesses: 0,
    baseIntervalDays: 1,
    dueOn: "2026-10-02",
    hadFullSuccess: true,
  });
});

test("un parcial no cambia el calendario", () => {
  const schedule: Schedule = {
    consecutiveFullSuccesses: 2,
    baseIntervalDays: 3,
    dueOn: null,
    hadFullSuccess: true,
  };
  const next = nextSchedule({
    schedule,
    outcome: "parcial",
    priority: "maxima",
    sessionDate: "2026-10-01",
  });
  assert.deepEqual(next, schedule);
  assert.notEqual(next, schedule);
});
