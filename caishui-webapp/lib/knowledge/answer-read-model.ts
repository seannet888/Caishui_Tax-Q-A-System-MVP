// lib/knowledge/answer-read-model.ts
// 历史答案只读模型：Answer + Citation Snapshot + Annotation -> API/前端展示结构。

import { prisma } from "@/lib/db/client";
import { assertCitationSnapshot } from "@/lib/knowledge/citation";
import { presentCitation } from "@/lib/knowledge/citation-presentation";
import type { CitationAnnotationInput } from "@/lib/knowledge/citation-presentation";
import type { AnswerHistoryItem } from "@/types/api";
import type { CitationSnapshot } from "@/types/knowledge";

type StoredAnswer = {
  id: string;
  conversation_id: string;
  original_question: string;
  retrieval_query: string | null;
  answer_text: string | null;
  status: string;
  model: string;
  prompt_template_version: string;
  coverage_evidence_snapshot: unknown;
  started_at: Date;
  completed_at: Date | null;
  failed_at?: Date | null;
  error_code?: string | null;
  error_message?: string | null;
  citations: Array<{
    id: string;
    snapshot: unknown;
    annotations: CitationAnnotationInput[];
  }>;
};

export interface AnswerHistoryStore {
  answer: {
    findMany(input: {
      where: {
        conversation_id: string;
        OR: Array<
          | { status: "COMPLETED"; answer_text: { not: null } }
          | { status: "FAILED" }
        >;
      };
      orderBy: { started_at: "asc" };
      take: number;
      select: {
        id: true;
        conversation_id: true;
        original_question: true;
        retrieval_query: true;
        answer_text: true;
        status: true;
        model: true;
        prompt_template_version: true;
        coverage_evidence_snapshot: true;
        started_at: true;
        completed_at: true;
        failed_at: true;
        error_code: true;
        error_message: true;
        citations: {
          orderBy: { created_at: "asc" };
          select: {
            id: true;
            snapshot: true;
            annotations: {
              orderBy: { created_at: "asc" };
              select: {
                annotation_type: true;
                message: true;
                resolved_at: true;
              };
            };
          };
        };
      };
    }): Promise<StoredAnswer[]>;
  };
}

export async function loadAnswerHistory(
  store: AnswerHistoryStore = prisma,
  conversationId: string,
  options: { limit?: number } = {},
): Promise<AnswerHistoryItem[]> {
  const answers = await store.answer.findMany({
    where: {
      conversation_id: conversationId,
      OR: [
        { status: "COMPLETED", answer_text: { not: null } },
        { status: "FAILED" },
      ],
    },
    orderBy: { started_at: "asc" },
    take: options.limit ?? 50,
    select: {
      id: true,
      conversation_id: true,
      original_question: true,
      retrieval_query: true,
      answer_text: true,
      status: true,
      model: true,
      prompt_template_version: true,
      coverage_evidence_snapshot: true,
      started_at: true,
      completed_at: true,
      failed_at: true,
      error_code: true,
      error_message: true,
      citations: {
        orderBy: { created_at: "asc" },
        select: {
          id: true,
          snapshot: true,
          annotations: {
            orderBy: { created_at: "asc" },
            select: {
              annotation_type: true,
              message: true,
              resolved_at: true,
            },
          },
        },
      },
    },
  });

  return answers.map(toHistoryItem);
}

function toHistoryItem(answer: StoredAnswer): AnswerHistoryItem {
  const base: AnswerHistoryItem = {
    id: answer.id,
    conversationId: answer.conversation_id,
    originalQuestion: answer.original_question,
    retrievalQuery: answer.retrieval_query,
    answerText: answer.answer_text ?? "",
    status: answer.status === "FAILED" ? "FAILED" : "COMPLETED",
    model: answer.model,
    promptTemplateVersion: answer.prompt_template_version,
    deterministicReason: extractDeterministicReason(
      answer.coverage_evidence_snapshot,
    ),
    startedAt: answer.started_at.toISOString(),
    completedAt: answer.completed_at?.toISOString() ?? null,
    citations: answer.citations.map((citation) => {
      const snapshot = citation.snapshot as CitationSnapshot;
      assertCitationSnapshot(snapshot);
      return presentCitation({
        id: citation.id,
        snapshot,
        annotations: citation.annotations,
      });
    }),
  };
  if (answer.status === "FAILED") {
    return {
      ...base,
      failedAt: answer.failed_at?.toISOString() ?? null,
      errorCode: answer.error_code,
      errorMessage: answer.error_message,
    };
  }
  return base;
}

function extractDeterministicReason(
  coverageSnapshot: unknown,
): AnswerHistoryItem["deterministicReason"] {
  if (!coverageSnapshot || typeof coverageSnapshot !== "object") {
    return undefined;
  }
  const value = (coverageSnapshot as { deterministicAnswerReason?: unknown })
    .deterministicAnswerReason;
  if (value === "needs_clarification" || value === "no_evidence") {
    return value;
  }
  return undefined;
}
