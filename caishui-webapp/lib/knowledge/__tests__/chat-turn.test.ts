import { describe, expect, it } from "vitest";
import { planChatTurn } from "@/lib/knowledge/chat-turn";
import { NO_EVIDENCE_TEMPLATE } from "@/lib/knowledge/evidence";

describe("planChatTurn", () => {
  it("returns a persisted deterministic clarification when standalone query needs clarification", async () => {
    const calls: string[] = [];

    const result = await planChatTurn(
      {
        conversationId: "conversation-1",
        question: "那上海呢？",
        history: [],
      },
      {
        resolveHistory: async () => {
          calls.push("resolveHistory");
          return [];
        },
        generateStandaloneQuery: () => ({
          status: "needs_clarification",
          question: "请问您指的是哪项政策或税务事项？",
          contextSnapshot: [{ role: "user", content: "那上海呢？" }],
        }),
        evaluateEvidencePolicy: () => {
          throw new Error("policy should not run");
        },
        retrieve: async () => {
          throw new Error("retrieval should not run");
        },
        persistDeterministicAnswer: async (_store, input) => {
          calls.push("persistDeterministicAnswer");
          expect(input).toMatchObject({
            conversationId: "conversation-1",
            originalQuestion: "那上海呢？",
            retrievalQuery: null,
            answerText: "请问您指的是哪项政策或税务事项？",
            reason: "needs_clarification",
          });
          return { id: "answer-1" };
        },
      },
    );

    expect(result).toEqual({
      kind: "deterministic",
      event: {
        type: "needs_clarification",
        question: "请问您指的是哪项政策或税务事项？",
      },
    });
    expect(calls).toEqual(["resolveHistory", "persistDeterministicAnswer"]);
  });

  it("clarifies before retrieval when evidence policy requires jurisdiction", async () => {
    const calls: string[] = [];

    const result = await planChatTurn(
      {
        conversationId: "conversation-1",
        question: "社保缴费比例是多少？",
        history: [],
      },
      {
        resolveHistory: async () => [],
        generateStandaloneQuery: () => ({
          status: "ready",
          query: "社保缴费比例是多少？",
          contextSnapshot: [],
        }),
        evaluateEvidencePolicy: (input) => {
          calls.push("evaluateEvidencePolicy");
          expect(input).toEqual({
            query: "社保缴费比例是多少？",
            jurisdiction: undefined,
          });
          return {
            action: "clarify",
            reason: "local_sensitive_query_requires_jurisdiction",
            question: "不同地区的标准可能不同，请问您需要了解哪个地区的政策？",
          };
        },
        retrieve: async () => {
          throw new Error("retrieval should not run");
        },
        persistDeterministicAnswer: async (_store, input) => {
          calls.push("persistDeterministicAnswer");
          expect(input).toMatchObject({
            conversationId: "conversation-1",
            originalQuestion: "社保缴费比例是多少？",
            retrievalQuery: "社保缴费比例是多少？",
            answerText: "不同地区的标准可能不同，请问您需要了解哪个地区的政策？",
            reason: "needs_clarification",
          });
          return { id: "answer-1" };
        },
      },
    );

    expect(result).toEqual({
      kind: "deterministic",
      event: {
        type: "needs_clarification",
        question: "不同地区的标准可能不同，请问您需要了解哪个地区的政策？",
      },
    });
    expect(calls).toEqual([
      "evaluateEvidencePolicy",
      "persistDeterministicAnswer",
    ]);
  });

  it("persists a deterministic no-evidence answer after retrieval returns no usable evidence", async () => {
    const coverageEvidence = {
      sourcesHit: [],
      dateRange: {},
      documentTypesHit: [],
      globalSourceHealth: [],
    };
    const calls: string[] = [];

    const result = await planChatTurn(
      {
        conversationId: "conversation-1",
        question: "有没有出台配套细则？",
        history: [],
      },
      {
        resolveHistory: async () => [],
        generateStandaloneQuery: () => ({
          status: "ready",
          query: "有没有出台配套细则？",
          contextSnapshot: [],
        }),
        evaluateEvidencePolicy: (input) => {
          calls.push(input.chunks ? "postPolicy" : "prePolicy");
          if (!input.chunks) return { action: "proceed" };
          return {
            action: "no_evidence",
            assessment: {
              state: "NO_EVIDENCE",
              score: 0,
              reasons: ["no_verified_chunks"],
            },
          };
        },
        retrieve: async () => {
          calls.push("retrieve");
          return {
            chunks: [],
            coverageEvidence,
            queryPlan: {
              temporalIntent: "current_validity",
              latestIntent: "current_effective_policy",
              executions: [{ id: "primary", temporalScope: "current" }],
              rankingMode: "effective_date",
              effectivityLabelRequired: false,
              strictDateOrdering: false,
            },
          };
        },
        persistDeterministicAnswer: async (_store, input) => {
          calls.push("persistDeterministicAnswer");
          expect(input).toMatchObject({
            conversationId: "conversation-1",
            originalQuestion: "有没有出台配套细则？",
            retrievalQuery: "有没有出台配套细则？",
            answerText: NO_EVIDENCE_TEMPLATE,
            reason: "no_evidence",
            coverageEvidence,
          });
          return { id: "answer-no-evidence" };
        },
      },
    );

    expect(result).toEqual({
      kind: "deterministic",
      event: {
        type: "no_evidence",
        message: NO_EVIDENCE_TEMPLATE,
      },
    });
    expect(calls).toEqual([
      "prePolicy",
      "retrieve",
      "postPolicy",
      "persistDeterministicAnswer",
    ]);
  });

  it("does not retrieve or generate for non-tax labor contract questions", async () => {
    const calls: string[] = [];

    const result = await planChatTurn(
      {
        conversationId: "conversation-1",
        question: "劳动者发生什么情况，用人单位可解除合同？",
        history: [],
      },
      {
        resolveHistory: async () => [],
        generateStandaloneQuery: () => ({
          status: "ready",
          query: "劳动者发生什么情况，用人单位可解除合同？",
          contextSnapshot: [],
        }),
        evaluateEvidencePolicy: (input) => {
          calls.push("evaluateEvidencePolicy");
          expect(input).toEqual({
            query: "劳动者发生什么情况，用人单位可解除合同？",
            jurisdiction: undefined,
          });
          return {
            action: "no_evidence",
            assessment: {
              state: "NO_EVIDENCE",
              score: 0,
              reasons: ["non_tax_query_out_of_scope"],
            },
          };
        },
        retrieve: async () => {
          throw new Error("retrieval should not run for non-tax questions");
        },
        persistDeterministicAnswer: async (_store, input) => {
          calls.push("persistDeterministicAnswer");
          expect(input).toMatchObject({
            conversationId: "conversation-1",
            originalQuestion: "劳动者发生什么情况，用人单位可解除合同？",
            retrievalQuery: "劳动者发生什么情况，用人单位可解除合同？",
            answerText: NO_EVIDENCE_TEMPLATE,
            reason: "no_evidence",
          });
          return { id: "answer-out-of-scope" };
        },
      },
    );

    expect(result).toEqual({
      kind: "deterministic",
      event: {
        type: "no_evidence",
        message: NO_EVIDENCE_TEMPLATE,
      },
    });
    expect(calls).toEqual([
      "evaluateEvidencePolicy",
      "persistDeterministicAnswer",
    ]);
  });

  it("persists a failed answer and returns a user-facing error when retrieval is unavailable", async () => {
    const calls: string[] = [];

    const result = await planChatTurn(
      {
        conversationId: "conversation-1",
        question: "研发费用加计扣除最新政策是什么？",
        history: [],
      },
      {
        resolveHistory: async () => [],
        generateStandaloneQuery: () => ({
          status: "ready",
          query: "研发费用加计扣除当前适用政策",
          contextSnapshot: [{ role: "user", content: "研发费用加计扣除最新政策是什么？" }],
        }),
        evaluateEvidencePolicy: (input) => {
          calls.push(input.chunks ? "postPolicy" : "prePolicy");
          return { action: "proceed" };
        },
        retrieve: async () => {
          calls.push("retrieve");
          throw new Error("Request failed with status code 401");
        },
        persistDeterministicAnswer: async () => {
          throw new Error("deterministic answer should not be persisted");
        },
        persistRetrievalFailureAnswer: async (_store, input) => {
          calls.push("persistRetrievalFailureAnswer");
          expect(input).toMatchObject({
            conversationId: "conversation-1",
            originalQuestion: "研发费用加计扣除最新政策是什么？",
            retrievalQuery: "研发费用加计扣除当前适用政策",
            errorCode: "query_embedding_auth_failed",
            errorMessage: "Request failed with status code 401",
          });
          return { id: "answer-failed-retrieval" };
        },
      },
    );

    expect(result).toEqual({
      kind: "deterministic",
      event: {
        type: "error",
        code: "retrieval_unavailable",
        message: "当前检索服务暂时不可用，无法完成知识库查询。请稍后重试；如果持续出现，请检查 Embedding API 配置。",
      },
    });
    expect(calls).toEqual([
      "prePolicy",
      "retrieve",
      "persistRetrievalFailureAnswer",
    ]);
  });

  it("preserves post-retrieval clarification decisions", async () => {
    const coverageEvidence = {
      sourcesHit: ["财政部官网"],
      dateRange: {},
      documentTypesHit: ["notice"],
      globalSourceHealth: [],
    };

    const result = await planChatTurn(
      {
        conversationId: "conversation-1",
        question: "地方附加税怎么交？",
        history: [],
      },
      {
        resolveHistory: async () => [],
        generateStandaloneQuery: () => ({
          status: "ready",
          query: "地方附加税怎么交？",
          contextSnapshot: [],
        }),
        evaluateEvidencePolicy: (input) => {
          if (!input.chunks) return { action: "proceed" };
          return {
            action: "clarify",
            reason: "local_sensitive_query_requires_jurisdiction",
            question: "不同地区的标准可能不同，请问您需要了解哪个地区的政策？",
          };
        },
        retrieve: async () => ({
          chunks: [],
          coverageEvidence,
          queryPlan: {
            temporalIntent: "current_validity",
            latestIntent: "current_effective_policy",
            executions: [{ id: "primary", temporalScope: "current" }],
            rankingMode: "effective_date",
            effectivityLabelRequired: false,
            strictDateOrdering: false,
          },
        }),
        persistDeterministicAnswer: async (_store, input) => {
          expect(input).toMatchObject({
            retrievalQuery: "地方附加税怎么交？",
            answerText: "不同地区的标准可能不同，请问您需要了解哪个地区的政策？",
            reason: "needs_clarification",
            coverageEvidence,
          });
          return { id: "answer-clarify" };
        },
      },
    );

    expect(result).toEqual({
      kind: "deterministic",
      event: {
        type: "needs_clarification",
        question: "不同地区的标准可能不同，请问您需要了解哪个地区的政策？",
      },
    });
  });

  it("returns answer generation input when retrieval evidence is sufficient", async () => {
    const chunk = {
      id: "chunk-1",
      document_id: "doc-1",
      content: "第一条 企业发生符合条件的研发费用，可以加计扣除。",
      content_hash: "h".repeat(64),
      chunk_type: "article",
      similarity: 0.91,
      distance: 0.09,
      title: "研发费用政策",
      source_document_name: "研发费用政策.pdf",
      doc_number: "财税〔2023〕6号",
      authority_rank: 70,
      jurisdiction: "全国",
      doc_type: "notice",
      provision_type: "normative",
      retrieval_execution: "primary",
    };
    const coverageEvidence = {
      sourcesHit: ["财政部官网"],
      dateRange: {},
      documentTypesHit: ["notice"],
      globalSourceHealth: [],
    };
    const queryPlan = {
      temporalIntent: "current_validity" as const,
      latestIntent: "current_effective_policy" as const,
      executions: [{ id: "primary" as const, temporalScope: "current" as const }],
      rankingMode: "effective_date" as const,
      effectivityLabelRequired: false,
      strictDateOrdering: false,
    };

    const result = await planChatTurn(
      {
        conversationId: "conversation-1",
        question: "研发费用加计扣除最新政策是什么？",
        history: [],
      },
      {
        resolveHistory: async () => [],
        generateStandaloneQuery: () => ({
          status: "ready",
          query: "研发费用加计扣除当前适用政策",
          contextSnapshot: [{ role: "user", content: "研发费用加计扣除最新政策是什么？" }],
        }),
        evaluateEvidencePolicy: (input) => {
          if (!input.chunks) return { action: "proceed" };
          return {
            action: "generate",
            assessment: {
              state: "SUFFICIENT_EVIDENCE",
              score: 0.8,
              reasons: ["high_authority"],
            },
            promptDirectives: ["优先引用规范性文件。"],
          };
        },
        retrieve: async () => ({
          chunks: [chunk],
          coverageEvidence,
          queryPlan,
        }),
        persistDeterministicAnswer: async () => {
          throw new Error("deterministic answer should not be persisted");
        },
      },
    );

    expect(result).toEqual({
      kind: "generate",
      generationInput: {
        conversationId: "conversation-1",
        originalQuestion: "研发费用加计扣除最新政策是什么？",
        retrievalQuery: "研发费用加计扣除当前适用政策",
        contextSnapshot: [{ role: "user", content: "研发费用加计扣除最新政策是什么？" }],
        chunks: [chunk],
        coverageEvidence,
        queryPlan,
        evidenceState: "SUFFICIENT_EVIDENCE",
        promptDirectives: ["优先引用规范性文件。"],
      },
    });
  });
});
