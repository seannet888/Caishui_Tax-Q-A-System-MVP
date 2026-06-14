// Answer Finalization Module：答案草稿成为正式答案的唯一领域入口。

import type { CitationSnapshot, RetrievedEvidence } from "@/types/knowledge";
import {
  assertCitationSnapshot,
  checkCitationGrounding,
  createCitationSnapshot,
} from "@/lib/knowledge/citation";

export interface AnswerFinalizationRepository {
  commit(input: {
    answerId: string;
    answerText: string;
    citations: CitationSnapshot[];
  }): Promise<void>;
  reject(input: { answerId: string; errors: string[] }): Promise<void>;
}

export type AnswerFinalizationResult =
  | { status: "completed" }
  | { status: "failed"; errorCode: "grounding_failed" };

export async function finalizeAnswer(
  input: {
    answerId: string;
    answerText: string;
    evidence: RetrievedEvidence[];
  },
  repository: AnswerFinalizationRepository,
): Promise<AnswerFinalizationResult> {
  const candidates = input.evidence.map((item) => createCitationSnapshot(item));
  const grounding = checkCitationGrounding(input.answerText, candidates);
  if (!grounding.ok) {
    await repository.reject({
      answerId: input.answerId,
      errors: grounding.errors,
    });
    return { status: "failed", errorCode: "grounding_failed" };
  }

  const usedCitations = grounding.usedCitationIndexes.map(
    (index) => candidates[index - 1]!,
  );
  usedCitations.forEach(assertCitationSnapshot);

  await repository.commit({
    answerId: input.answerId,
    answerText: input.answerText,
    citations: usedCitations,
  });
  return { status: "completed" };
}
