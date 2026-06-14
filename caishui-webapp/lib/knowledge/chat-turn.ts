// Chat Turn Orchestration Module：把单轮问答从上下文补全到检索/生成路径的决策收口。

import type { ChatRequest, ChatStreamEvent } from "@/types/api";
import type {
  ConversationTurn,
  StandaloneQueryResult,
} from "@/types/knowledge";
import type { RetrievalResult } from "@/lib/knowledge/retriever";
import type { AnswerGenerationInput } from "@/lib/knowledge/answer-generation";
import type { EvidencePolicyDecision } from "@/lib/knowledge/evidence-policy";
import {
  generateRetrievalCoverageEvidence,
  type RetrievalCoverageEvidence,
} from "@/lib/knowledge/coverage-evidence";
import {
  persistDeterministicAnswer,
  type DeterministicAnswerStore,
  type DeterministicAnswerReason,
} from "@/lib/knowledge/deterministic-answer";
import {
  classifyRetrievalFailure,
  persistRetrievalFailureAnswer,
  RETRIEVAL_UNAVAILABLE_MESSAGE,
  type RetrievalFailureAnswerStore,
  type RetrievalFailureCode,
} from "@/lib/knowledge/retrieval-failure-answer";
import { getErrorMessage } from "@/lib/utils/error";
import { resolveConversationHistory } from "@/lib/knowledge/conversation-history";
import { generateStandaloneQuery } from "@/lib/knowledge/standalone-query";
import { evaluateEvidencePolicy } from "@/lib/knowledge/evidence-policy";
import { retrieve } from "@/lib/knowledge/retriever";
import { NO_EVIDENCE_TEMPLATE } from "@/lib/knowledge/evidence";

export type ChatTurnResult =
  | { kind: "deterministic"; event: ChatStreamEvent }
  | { kind: "generate"; generationInput: AnswerGenerationInput };

export interface ChatTurnDependencies {
  resolveHistory(
    store: undefined,
    conversationId: string,
    fallbackHistory: ConversationTurn[],
  ): Promise<ConversationTurn[]>;
  generateStandaloneQuery(
    recentTurns: ConversationTurn[],
    currentQuestion: string,
  ): StandaloneQueryResult;
  evaluateEvidencePolicy(input: {
    query: string;
    jurisdiction?: string;
    chunks?: RetrievalResult["chunks"];
  }): EvidencePolicyDecision;
  retrieve(params: {
    query: string;
    jurisdiction?: string;
    queryDate?: string;
  }): Promise<RetrievalResult>;
  persistDeterministicAnswer(
    store: DeterministicAnswerStore | undefined,
    input: {
      conversationId: string;
      originalQuestion: string;
      retrievalQuery: string | null;
      contextSnapshot: unknown;
      answerText: string;
      reason: DeterministicAnswerReason;
      coverageEvidence: RetrievalCoverageEvidence;
    },
  ): Promise<{ id: string }>;
  persistRetrievalFailureAnswer?(
    store: RetrievalFailureAnswerStore | undefined,
    input: {
      conversationId: string;
      originalQuestion: string;
      retrievalQuery: string | null;
      contextSnapshot: unknown;
      errorCode: RetrievalFailureCode;
      errorMessage: string;
      coverageEvidence: RetrievalCoverageEvidence;
    },
  ): Promise<{ id: string }>;
}

const productionDependencies: ChatTurnDependencies = {
  resolveHistory: resolveConversationHistory,
  generateStandaloneQuery,
  evaluateEvidencePolicy,
  retrieve,
  persistDeterministicAnswer,
  persistRetrievalFailureAnswer,
};

export async function planChatTurn(
  request: ChatRequest,
  dependencies: ChatTurnDependencies = productionDependencies,
): Promise<ChatTurnResult> {
  const history = await dependencies.resolveHistory(
    undefined,
    request.conversationId,
    request.history ?? [],
  );
  const standalone = dependencies.generateStandaloneQuery(
    history,
    request.question,
  );

  if (standalone.status === "needs_clarification") {
    await persistDeterministicTurn(dependencies, request, {
      retrievalQuery: null,
      contextSnapshot: standalone.contextSnapshot,
      answerText: standalone.question,
      reason: "needs_clarification",
      coverageEvidence: generateRetrievalCoverageEvidence([]),
    });
    return {
      kind: "deterministic",
      event: {
        type: "needs_clarification",
        question: standalone.question,
      },
    };
  }

  const preflight = dependencies.evaluateEvidencePolicy({
    query: standalone.query,
    jurisdiction: request.jurisdiction,
  });
  if (preflight.action === "clarify") {
    await persistDeterministicTurn(dependencies, request, {
      retrievalQuery: standalone.query,
      contextSnapshot: standalone.contextSnapshot,
      answerText: preflight.question,
      reason: "needs_clarification",
      coverageEvidence: generateRetrievalCoverageEvidence([]),
    });
    return {
      kind: "deterministic",
      event: {
        type: "needs_clarification",
        question: preflight.question,
      },
    };
  }

  let retrieval: RetrievalResult;
  try {
    retrieval = await dependencies.retrieve({
      query: standalone.query,
      jurisdiction: request.jurisdiction,
      queryDate: request.queryDate,
    });
  } catch (error) {
    await persistRetrievalFailureTurn(dependencies, request, {
      retrievalQuery: standalone.query,
      contextSnapshot: standalone.contextSnapshot,
      errorCode: classifyRetrievalFailure(error),
      errorMessage: getErrorMessage(error),
      coverageEvidence: generateRetrievalCoverageEvidence([]),
    });
    return {
      kind: "deterministic",
      event: {
        type: "error",
        code: "retrieval_unavailable",
        message: RETRIEVAL_UNAVAILABLE_MESSAGE,
      },
    };
  }
  const policy = dependencies.evaluateEvidencePolicy({
    query: standalone.query,
    jurisdiction: request.jurisdiction,
    chunks: retrieval.chunks,
  });

  if (policy.action === "clarify") {
    await persistDeterministicTurn(dependencies, request, {
      retrievalQuery: standalone.query,
      contextSnapshot: standalone.contextSnapshot,
      answerText: policy.question,
      reason: "needs_clarification",
      coverageEvidence: retrieval.coverageEvidence,
    });
    return {
      kind: "deterministic",
      event: {
        type: "needs_clarification",
        question: policy.question,
      },
    };
  }

  if (policy.action !== "generate") {
    await persistDeterministicTurn(dependencies, request, {
      retrievalQuery: standalone.query,
      contextSnapshot: standalone.contextSnapshot,
      answerText: NO_EVIDENCE_TEMPLATE,
      reason: "no_evidence",
      coverageEvidence: retrieval.coverageEvidence,
    });
    return {
      kind: "deterministic",
      event: {
        type: "no_evidence",
        message: NO_EVIDENCE_TEMPLATE,
      },
    };
  }

  return {
    kind: "generate",
    generationInput: {
      conversationId: request.conversationId,
      originalQuestion: request.question,
      retrievalQuery: standalone.query,
      contextSnapshot: standalone.contextSnapshot,
      chunks: retrieval.chunks,
      coverageEvidence: retrieval.coverageEvidence,
      queryPlan: retrieval.queryPlan,
      evidenceState: policy.assessment.state,
      promptDirectives: policy.promptDirectives,
    },
  };
}

async function persistRetrievalFailureTurn(
  dependencies: ChatTurnDependencies,
  request: ChatRequest,
  input: {
    retrievalQuery: string | null;
    contextSnapshot: unknown;
    errorCode: RetrievalFailureCode;
    errorMessage: string;
    coverageEvidence: RetrievalCoverageEvidence;
  },
): Promise<void> {
  await (dependencies.persistRetrievalFailureAnswer ?? persistRetrievalFailureAnswer)(
    undefined,
    {
      conversationId: request.conversationId,
      originalQuestion: request.question,
      retrievalQuery: input.retrievalQuery,
      contextSnapshot: input.contextSnapshot,
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
      coverageEvidence: input.coverageEvidence,
    },
  );
}

async function persistDeterministicTurn(
  dependencies: ChatTurnDependencies,
  request: ChatRequest,
  input: {
    retrievalQuery: string | null;
    contextSnapshot: unknown;
    answerText: string;
    reason: DeterministicAnswerReason;
    coverageEvidence: RetrievalCoverageEvidence;
  },
): Promise<void> {
  await dependencies.persistDeterministicAnswer(undefined, {
    conversationId: request.conversationId,
    originalQuestion: request.question,
    retrievalQuery: input.retrievalQuery,
    contextSnapshot: input.contextSnapshot,
    answerText: input.answerText,
    reason: input.reason,
    coverageEvidence: input.coverageEvidence,
  });
}
