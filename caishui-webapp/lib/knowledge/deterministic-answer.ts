// lib/knowledge/deterministic-answer.ts
// 不调用模型的确定性回答持久化：澄清、零证据等路径也必须进入 Answer 审计链。

import { prisma } from "@/lib/db/client";
import type { RetrievalCoverageEvidence } from "@/lib/knowledge/coverage-evidence";
import { PROMPT_TEMPLATE_VERSION } from "@/lib/knowledge/prompt-templates";

export const DETERMINISTIC_ANSWER_MODEL = "deterministic-template";

export type DeterministicAnswerReason =
  | "needs_clarification"
  | "no_evidence";

export interface DeterministicAnswerStore {
  answer: {
    create(input: {
      data: {
        conversation_id: string;
        original_question: string;
        retrieval_query: string | null;
        context_snapshot: object;
        status: "COMPLETED";
        answer_text: string;
        model: string;
        prompt_template_version: string;
        coverage_evidence_snapshot: object;
        completed_at: Date;
      };
    }): Promise<{ id: string }>;
  };
}

export async function persistDeterministicAnswer(
  store: DeterministicAnswerStore = prisma,
  input: {
    conversationId: string;
    originalQuestion: string;
    retrievalQuery: string | null;
    contextSnapshot: unknown;
    answerText: string;
    reason: DeterministicAnswerReason;
    coverageEvidence: RetrievalCoverageEvidence;
  },
): Promise<{ id: string }> {
  return store.answer.create({
    data: {
      conversation_id: input.conversationId,
      original_question: input.originalQuestion,
      retrieval_query: input.retrievalQuery,
      context_snapshot: input.contextSnapshot as object,
      status: "COMPLETED",
      answer_text: input.answerText,
      model: DETERMINISTIC_ANSWER_MODEL,
      prompt_template_version: PROMPT_TEMPLATE_VERSION,
      coverage_evidence_snapshot: {
        ...input.coverageEvidence,
        deterministicAnswerReason: input.reason,
      } as unknown as object,
      completed_at: new Date(),
    },
  });
}
