import { prisma } from "@/lib/db/client";
import {
  generateRetrievalCoverageEvidence,
  type RetrievalCoverageEvidence,
} from "@/lib/knowledge/coverage-evidence";
import { PROMPT_TEMPLATE_VERSION } from "@/lib/knowledge/prompt-templates";
import { getErrorMessage } from "@/lib/utils/error";

export const RETRIEVAL_FAILURE_MODEL = "retrieval-readiness";
export const RETRIEVAL_UNAVAILABLE_MESSAGE =
  "当前检索服务暂时不可用，无法完成知识库查询。请稍后重试；如果持续出现，请检查 Embedding API 配置。";

export type RetrievalFailureCode =
  | "query_embedding_auth_failed"
  | "query_embedding_timeout"
  | "query_embedding_failed";

export interface RetrievalFailureAnswerStore {
  answer: {
    create(input: {
      data: {
        conversation_id: string;
        original_question: string;
        retrieval_query: string | null;
        context_snapshot: object;
        status: "FAILED";
        model: string;
        prompt_template_version: string;
        coverage_evidence_snapshot: object;
        failed_at: Date;
        error_code: RetrievalFailureCode;
        error_message: string;
      };
    }): Promise<{ id: string }>;
  };
}

export function classifyRetrievalFailure(error: unknown): RetrievalFailureCode {
  const message = getErrorMessage(error).toLowerCase();
  if (
    message.includes("status code 401") ||
    message.includes("status code 403") ||
    message.includes("unauthorized") ||
    message.includes("forbidden")
  ) {
    return "query_embedding_auth_failed";
  }
  if (
    message.includes("timeout") ||
    message.includes("etimedout") ||
    message.includes("econnrefused") ||
    message.includes("enotfound")
  ) {
    return "query_embedding_timeout";
  }
  return "query_embedding_failed";
}

export async function persistRetrievalFailureAnswer(
  store: RetrievalFailureAnswerStore = prisma,
  input: {
    conversationId: string;
    originalQuestion: string;
    retrievalQuery: string | null;
    contextSnapshot: unknown;
    errorCode: RetrievalFailureCode;
    errorMessage: string;
    coverageEvidence?: RetrievalCoverageEvidence;
  },
): Promise<{ id: string }> {
  return store.answer.create({
    data: {
      conversation_id: input.conversationId,
      original_question: input.originalQuestion,
      retrieval_query: input.retrievalQuery,
      context_snapshot: input.contextSnapshot as object,
      status: "FAILED",
      model: RETRIEVAL_FAILURE_MODEL,
      prompt_template_version: PROMPT_TEMPLATE_VERSION,
      coverage_evidence_snapshot: {
        ...(input.coverageEvidence ?? generateRetrievalCoverageEvidence([])),
        retrievalFailure: {
          errorCode: input.errorCode,
          errorMessage: input.errorMessage,
        },
      } as unknown as object,
      failed_at: new Date(),
      error_code: input.errorCode,
      error_message: input.errorMessage,
    },
  });
}
