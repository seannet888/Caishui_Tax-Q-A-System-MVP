import { describe, expect, it } from "vitest";
import {
  hydrateMessagesFromAnswerHistory,
  mergeCompletedAnswerHydration,
} from "@/app/qa/components/history-hydration";
import type { AnswerHistoryItem } from "@/types/api";

function answer(partial: Partial<AnswerHistoryItem> = {}): AnswerHistoryItem {
  return {
    id: "answer-1",
    conversationId: "conversation-1",
    originalQuestion: "研发费用加计扣除的最新政策是什么？",
    retrievalQuery: "研发费用加计扣除 当前适用政策",
    answerText: "回答正文 [1]",
    status: "COMPLETED",
    model: "deepseek-chat",
    promptTemplateVersion: "v1",
    startedAt: "2026-06-11T00:00:00.000Z",
    completedAt: "2026-06-11T00:00:03.000Z",
    citations: [
      {
        id: "citation-1",
        chunkId: "chunk-1",
        docNumber: "财税〔2024〕1号",
        title: "测试文件",
        sourceDocumentName: "source.pdf",
        answeredAt: "2026-06-11T00:00:00.000Z",
        evidenceExcerpt: "回答时的证据片段。",
        isTruncated: false,
        includesTable: false,
        tableTruncated: false,
        snapshotContentHash:
          "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        status: "withdrawn",
        severity: "warning",
        badges: ["来源已撤出"],
        warnings: ["该引用来源已从当前知识库中撤出。"],
      },
    ],
    ...partial,
  };
}

describe("hydrateMessagesFromAnswerHistory", () => {
  it("将历史答案还原为 QA 消息并保留引用展示状态", () => {
    expect(hydrateMessagesFromAnswerHistory([answer()])).toEqual([
      {
        role: "user",
        content: "研发费用加计扣除的最新政策是什么？",
        status: "completed",
      },
      {
        role: "assistant",
        content: "回答正文 [1]",
        status: "completed",
        meta: {
          answerId: "answer-1",
          model: "deepseek-chat",
          promptTemplateVersion: "v1",
          retrievalQuery: "研发费用加计扣除 当前适用政策",
          deterministicReason: undefined,
          startedAt: "2026-06-11T00:00:00.000Z",
          completedAt: "2026-06-11T00:00:03.000Z",
          failedAt: undefined,
        },
        citations: [
          expect.objectContaining({
            id: "citation-1",
            status: "withdrawn",
            severity: "warning",
            badges: ["来源已撤出"],
          }),
        ],
      },
    ]);
  });

  it("将失败答案还原为失败状态的助手消息", () => {
    expect(
      hydrateMessagesFromAnswerHistory([
        answer({
          id: "answer-failed-1",
          status: "FAILED",
          answerText: "",
          errorCode: "query_embedding_auth_failed",
          errorMessage: "Request failed with status code 401",
          failedAt: "2026-06-11T00:00:01.000Z",
          citations: [],
        }),
      ]),
    ).toEqual([
      {
        role: "user",
        content: "研发费用加计扣除的最新政策是什么？",
        status: "completed",
      },
      {
        role: "assistant",
        content: "当前检索服务暂时不可用，无法完成知识库查询。请稍后重试；如果持续出现，请检查 Embedding API 配置。",
        status: "failed",
        meta: {
          answerId: "answer-failed-1",
          model: "deepseek-chat",
          promptTemplateVersion: "v1",
          retrievalQuery: "研发费用加计扣除 当前适用政策",
          deterministicReason: undefined,
          startedAt: "2026-06-11T00:00:00.000Z",
          completedAt: "2026-06-11T00:00:03.000Z",
          failedAt: "2026-06-11T00:00:01.000Z",
        },
        citations: [],
      },
    ]);
  });

  it("用持久化正式答案替换已完成的流式草稿并保留引用快照", () => {
    const current = [
      {
        role: "user" as const,
        content: "财税测试公告的用途是什么？",
        status: "completed" as const,
      },
      {
        role: "assistant" as const,
        content: "根据根据资料资料，该该文件文件用于用于测试测试。[1]",
        status: "completed" as const,
      },
    ];
    const hydrated = hydrateMessagesFromAnswerHistory([
      answer({
        id: "answer-verified",
        originalQuestion: "财税测试公告的用途是什么？",
        answerText: "根据资料，该文件用于测试。[1]",
        promptTemplateVersion: "v1.1",
      }),
    ]);

    expect(
      mergeCompletedAnswerHydration(current, hydrated, "answer-verified"),
    ).toEqual([
      current[0],
      expect.objectContaining({
        role: "assistant",
        content: "根据资料，该文件用于测试。[1]",
        status: "completed",
        citations: expect.any(Array),
        meta: expect.objectContaining({
          answerId: "answer-verified",
          promptTemplateVersion: "v1.1",
        }),
      }),
    ]);
  });
});
