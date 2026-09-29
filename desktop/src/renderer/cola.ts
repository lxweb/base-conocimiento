export type SessionItem = {
  id: string;
  snapshot: {
    question: {
      id: string;
      type: "boolean" | "multiple_choice" | "written";
      prompt: string;
      correct: boolean | null;
      expectedAnswer: string | null;
      options: Array<{ id: string; text: string; kind: "falsa" | "verdadera" | "completa" }>;
    };
    knowledge: {
      title: string;
      explanation: string;
      example: string | null;
      link: string | null;
    };
  };
};

export type Draft =
  | { booleanChoice: boolean }
  | { optionId: string }
  | { writtenText: string; equivalent: boolean | null };

export function presentItem(item: SessionItem, draft: Draft | null) {
  const hidden = {
    prompt: item.snapshot.question.prompt,
    explanation: null as string | null,
    expectedAnswer: null as string | null,
    title: null as string | null,
    readyToEnqueue: false,
  };
  if (!draft) return hidden;
  const revealed = {
    ...hidden,
    explanation: item.snapshot.knowledge.explanation,
    title: item.snapshot.knowledge.title,
  };
  if ("booleanChoice" in draft) return { ...revealed, readyToEnqueue: true };
  if ("optionId" in draft) return { ...revealed, readyToEnqueue: true };
  return {
    ...revealed,
    expectedAnswer: item.snapshot.question.expectedAnswer,
    readyToEnqueue: draft.equivalent !== null,
  };
}

type ServerSnapshot = {
  question: SessionItem["snapshot"]["question"];
  knowledge?: SessionItem["snapshot"]["knowledge"];
  conocimiento?: SessionItem["snapshot"]["knowledge"];
};

export function toSessionItem(raw: { id: string; snapshot: ServerSnapshot }): SessionItem {
  const knowledge = raw.snapshot.knowledge ?? raw.snapshot.conocimiento;
  if (!knowledge) throw new Error("snapshot sin conocimiento");
  return { id: raw.id, snapshot: { question: raw.snapshot.question, knowledge } };
}
