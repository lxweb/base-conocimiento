import { daysOverdue } from "./dates.ts";
import type { Priority } from "./schedule.ts";

export type QueueCandidate = {
  conocimientoId: string;
  priority: Priority;
  consecutiveFullSuccesses: number;
  hadFullSuccess: boolean;
  dueOn: string | null;
  archived: boolean;
  hasQuestion: boolean;
  materiaPosition: number;
  ramaPosition: number;
  temaPosition: number;
  conocimientoPosition: number;
};

const PRIORITY_RANK: Record<Priority, number> = {
  maxima: 0,
  alta: 1,
  normal: 2,
};

function isDue(candidate: QueueCandidate, today: string): boolean {
  return candidate.dueOn === null || candidate.dueOn <= today;
}

function compare(a: QueueCandidate, b: QueueCandidate, today: string): number {
  const byPriority = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  if (byPriority !== 0) return byPriority;
  const overdueA = daysOverdue(a.dueOn, today);
  const overdueB = daysOverdue(b.dueOn, today);
  if (overdueA !== overdueB) {
    if (overdueA > overdueB) return -1;
    return 1;
  }
  return (
    a.materiaPosition - b.materiaPosition ||
    a.ramaPosition - b.ramaPosition ||
    a.temaPosition - b.temaPosition ||
    a.conocimientoPosition - b.conocimientoPosition ||
    a.conocimientoId.localeCompare(b.conocimientoId)
  );
}

export function selectQueue(candidates: QueueCandidate[], today: string): string[] {
  const eligible = candidates.filter(
    (candidate) => !candidate.archived && candidate.hasQuestion && isDue(candidate, today),
  );
  const sort = (group: QueueCandidate[]) => [...group].sort((a, b) => compare(a, b, today));
  const nuevos = sort(eligible.filter((candidate) => !candidate.hadFullSuccess)).slice(0, 5);
  const resto = sort(eligible.filter((candidate) => candidate.hadFullSuccess)).slice(
    0,
    20 - nuevos.length,
  );
  return [...nuevos, ...resto].map((candidate) => candidate.conocimientoId);
}
