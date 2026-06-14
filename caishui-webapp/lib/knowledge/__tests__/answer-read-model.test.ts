import { describe, expect, it } from "vitest";
import { loadAnswerHistory } from "@/lib/knowledge/answer-read-model";

const validSnapshot = {
  chunkId: "cknowledgechunk0000000001",
  chunkContentHash:
    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  docNumber: "财税〔2024〕1号",
  title: "测试文件",
  evidenceExcerpt: "回答时的证据片段。",
  isTruncated: false,
  includesTable: false,
  tableTruncated: false,
  sourceDocumentName: "source.pdf",
  answeredAt: "2026-06-11T00:00:00.000Z",
};

describe("loadAnswerHistory", () => {
  it("读取已完成答案并返回带引用展示状态的历史记录", async () => {
    const store = {
      answer: {
        findMany: async () => [
          {
            id: "answer-1",
            conversation_id: "conversation-1",
            original_question: "研发费用加计扣除的最新政策是什么？",
            retrieval_query: "研发费用加计扣除 当前适用政策",
            answer_text: "回答正文 [1]",
            status: "COMPLETED",
            model: "deepseek-chat",
            prompt_template_version: "v1",
            coverage_evidence_snapshot: {},
            started_at: new Date("2026-06-11T00:00:00.000Z"),
            completed_at: new Date("2026-06-11T00:00:03.000Z"),
            citations: [
              {
                id: "citation-1",
                snapshot: validSnapshot,
                annotations: [
                  {
                    annotation_type: "source_withdrawn",
                    message: "该引用来源已从当前知识库中撤出。",
                    resolved_at: null,
                  },
                ],
              },
            ],
          },
        ],
      },
    };

    await expect(loadAnswerHistory(store, "conversation-1")).resolves.toEqual([
      {
        id: "answer-1",
        conversationId: "conversation-1",
        originalQuestion: "研发费用加计扣除的最新政策是什么？",
        retrievalQuery: "研发费用加计扣除 当前适用政策",
        answerText: "回答正文 [1]",
        status: "COMPLETED",
        model: "deepseek-chat",
        promptTemplateVersion: "v1",
        deterministicReason: undefined,
        startedAt: "2026-06-11T00:00:00.000Z",
        completedAt: "2026-06-11T00:00:03.000Z",
        citations: [
          expect.objectContaining({
            id: "citation-1",
            status: "withdrawn",
            severity: "warning",
            badges: ["来源已撤出"],
            evidenceExcerpt: "回答时的证据片段。",
          }),
        ],
      },
    ]);
  });

  it("投影确定性答案的生成原因，便于审计和前端展示", async () => {
    const store = {
      answer: {
        findMany: async () => [
          {
            id: "answer-deterministic-1",
            conversation_id: "conversation-1",
            original_question: "那上海呢？",
            retrieval_query: null,
            answer_text: "请问您指的是哪项政策或税务事项？",
            status: "COMPLETED",
            model: "deterministic-template",
            prompt_template_version: "v1",
            coverage_evidence_snapshot: {
              sourcesHit: [],
              dateRange: {},
              documentTypesHit: [],
              globalSourceHealth: [],
              deterministicAnswerReason: "needs_clarification",
            },
            started_at: new Date("2026-06-11T00:00:00.000Z"),
            completed_at: new Date("2026-06-11T00:00:01.000Z"),
            citations: [],
          },
        ],
      },
    };

    await expect(loadAnswerHistory(store, "conversation-1")).resolves.toEqual([
      expect.objectContaining({
        id: "answer-deterministic-1",
        model: "deterministic-template",
        deterministicReason: "needs_clarification",
        citations: [],
      }),
    ]);
  });

  it("投影失败答案的错误信息，便于检索失败审计和历史恢复", async () => {
    const store = {
      answer: {
        findMany: async () => [
          {
            id: "answer-failed-1",
            conversation_id: "conversation-1",
            original_question: "研发费用加计扣除最新政策是什么？",
            retrieval_query: "研发费用加计扣除当前适用政策",
            answer_text: null,
            status: "FAILED",
            model: "retrieval-readiness",
            prompt_template_version: "v1",
            coverage_evidence_snapshot: {
              sourcesHit: [],
              dateRange: {},
              documentTypesHit: [],
              globalSourceHealth: [],
              retrievalFailure: {
                errorCode: "query_embedding_auth_failed",
                errorMessage: "Request failed with status code 401",
              },
            },
            started_at: new Date("2026-06-11T00:00:00.000Z"),
            completed_at: null,
            failed_at: new Date("2026-06-11T00:00:01.000Z"),
            error_code: "query_embedding_auth_failed",
            error_message: "Request failed with status code 401",
            citations: [],
          },
        ],
      },
    };

    await expect(loadAnswerHistory(store, "conversation-1")).resolves.toEqual([
      expect.objectContaining({
        id: "answer-failed-1",
        status: "FAILED",
        answerText: "",
        errorCode: "query_embedding_auth_failed",
        errorMessage: "Request failed with status code 401",
        failedAt: "2026-06-11T00:00:01.000Z",
        citations: [],
      }),
    ]);
  });
});
