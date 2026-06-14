import { describe, expect, it } from "vitest";
import {
  classifyRetrievalFailure,
  persistRetrievalFailureAnswer,
  RETRIEVAL_FAILURE_MODEL,
} from "@/lib/knowledge/retrieval-failure-answer";

describe("classifyRetrievalFailure", () => {
  it("classifies embedding provider auth, timeout, and generic failures", () => {
    expect(classifyRetrievalFailure(new Error("Request failed with status code 401"))).toBe(
      "query_embedding_auth_failed",
    );
    expect(classifyRetrievalFailure(new Error("timeout of 60000ms exceeded"))).toBe(
      "query_embedding_timeout",
    );
    expect(classifyRetrievalFailure(new Error("query_embedding_failed"))).toBe(
      "query_embedding_failed",
    );
  });
});

describe("persistRetrievalFailureAnswer", () => {
  it("stores retrieval failures as FAILED answers with audit metadata", async () => {
    const created: unknown[] = [];
    const store = {
      answer: {
        create: async (input: unknown) => {
          created.push(input);
          return { id: "answer-failed" };
        },
      },
    };

    await expect(
      persistRetrievalFailureAnswer(store, {
        conversationId: "conversation-1",
        originalQuestion: "研发费用加计扣除最新政策是什么？",
        retrievalQuery: "研发费用加计扣除当前适用政策",
        contextSnapshot: [{ role: "user", content: "研发费用加计扣除最新政策是什么？" }],
        errorCode: "query_embedding_auth_failed",
        errorMessage: "Request failed with status code 401",
        coverageEvidence: {
          sourcesHit: [],
          dateRange: {},
          documentTypesHit: [],
          globalSourceHealth: [],
        },
      }),
    ).resolves.toEqual({ id: "answer-failed" });

    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      data: {
        conversation_id: "conversation-1",
        original_question: "研发费用加计扣除最新政策是什么？",
        retrieval_query: "研发费用加计扣除当前适用政策",
        status: "FAILED",
        model: RETRIEVAL_FAILURE_MODEL,
        error_code: "query_embedding_auth_failed",
        error_message: "Request failed with status code 401",
        coverage_evidence_snapshot: {
          sourcesHit: [],
          retrievalFailure: {
            errorCode: "query_embedding_auth_failed",
            errorMessage: "Request failed with status code 401",
          },
        },
      },
    });
  });
});
