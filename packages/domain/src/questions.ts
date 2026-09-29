import { questionTypeForPoints, type QuestionType } from "./points.ts";

export type QuestionRef = {
  id: string;
  type: QuestionType;
  lastAskedOn: string | null;
};

const ADVANCEMENT: QuestionType[] = ["boolean", "multiple_choice", "written"];

export function chooseQuestion(points: number, questions: QuestionRef[]): QuestionRef | null {
  if (questions.length === 0) return null;
  const desired = questionTypeForPoints(points);
  const available = ADVANCEMENT.filter((type) => questions.some((question) => question.type === type));
  const chosenType = available.includes(desired) ? desired : available[available.length - 1];
  const pool = questions.filter((question) => question.type === chosenType);
  return [...pool].sort((a, b) => {
    if (a.lastAskedOn === null && b.lastAskedOn !== null) return -1;
    if (a.lastAskedOn !== null && b.lastAskedOn === null) return 1;
    if (a.lastAskedOn !== b.lastAskedOn) return (a.lastAskedOn ?? "").localeCompare(b.lastAskedOn ?? "");
    return a.id.localeCompare(b.id);
  })[0];
}
