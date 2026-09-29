export type QuestionType = "boolean" | "multiple_choice" | "written";
export type OptionKind = "falsa" | "verdadera" | "completa";
export type Outcome = "pleno" | "parcial" | "error";

export function questionTypeForPoints(points: number): QuestionType {
  if (points <= 7) return "boolean";
  if (points <= 23) return "multiple_choice";
  return "written";
}

export function applyPoints(points: number, outcome: Outcome): number {
  if (outcome === "pleno") return points + 1;
  if (outcome === "error") return Math.max(0, points - 1);
  return points;
}

export function gradeBoolean(correct: boolean, chosen: boolean): Outcome {
  return chosen === correct ? "pleno" : "error";
}

export function gradeOption(kind: OptionKind): Outcome {
  if (kind === "completa") return "pleno";
  if (kind === "verdadera") return "parcial";
  return "error";
}

export function gradeWritten(equivalent: boolean): Outcome {
  return equivalent ? "pleno" : "error";
}
