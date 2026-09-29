import { addDays } from "./dates.ts";
import type { Outcome } from "./points.ts";

export type Priority = "normal" | "alta" | "maxima";

export type Schedule = {
  consecutiveFullSuccesses: number;
  baseIntervalDays: number;
  dueOn: string | null;
};

const FACTOR: Record<Priority, number> = {
  normal: 1,
  alta: 0.75,
  maxima: 0.5,
};

export function effectiveIntervalDays(baseIntervalDays: number, priority: Priority): number {
  return Math.max(1, Math.round(baseIntervalDays * FACTOR[priority]));
}

function baseAfterFullSuccess(schedule: Schedule): number {
  const successes = schedule.consecutiveFullSuccesses + 1;
  if (successes === 1) return 1;
  if (successes === 2) return 3;
  if (successes === 3) return 7;
  return Math.round(schedule.baseIntervalDays * 2.5);
}

export function nextSchedule(input: {
  schedule: Schedule;
  outcome: Outcome;
  priority: Priority;
  sessionDate: string;
}): Schedule {
  if (input.outcome === "parcial") return { ...input.schedule };
  if (input.outcome === "error") {
    return {
      consecutiveFullSuccesses: 0,
      baseIntervalDays: 1,
      dueOn: addDays(input.sessionDate, effectiveIntervalDays(1, input.priority)),
    };
  }
  const baseIntervalDays = baseAfterFullSuccess(input.schedule);
  return {
    consecutiveFullSuccesses: input.schedule.consecutiveFullSuccesses + 1,
    baseIntervalDays,
    dueOn: addDays(input.sessionDate, effectiveIntervalDays(baseIntervalDays, input.priority)),
  };
}
