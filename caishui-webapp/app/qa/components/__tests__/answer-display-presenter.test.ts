import { describe, expect, it } from "vitest";
import {
  presentHistoricalAssistantAnswer,
  presentStreamError,
} from "@/app/qa/components/answer-display-presenter";
import type { AnswerHistoryItem } from "@/types/api";

function answer(partial: Partial<AnswerHistoryItem> = {}): AnswerHistoryItem {
  return {
    id: "answer-1",
    conversationId: "conversation-1",
    originalQuestion: "研发费用加计扣除政策？",
    retrievalQuery: "研发费用加计扣除 当前适用政策",
    answerText: "回答正文",
    status: "COMPLETED",
    model: "deepseek-chat",
    promptTemplateVersion: "v1",
    startedAt: "2026-06-11T00:00:00.000Z",
    completedAt: "2026-06-11T00:00:03.000Z",
    citations: [],
    ...partial,
  };
}

describe("answer display presenter", () => {
  it("shows completed historical answers as completed content", () => {
    expect(presentHistoricalAssistantAnswer(answer())).toEqual({
      content: "回答正文",
      status: "completed",
    });
  });

  it("adds a deterministic no-evidence note to historical answers", () => {
    expect(
      presentHistoricalAssistantAnswer(
        answer({
          answerText: "当前知识库未检索到相关文件。",
          deterministicReason: "no_evidence",
        }),
      ),
    ).toEqual({
      content:
        "当前知识库未检索到相关文件。\n\n提示：这是系统在无可用检索证据时返回的确定性回答，未调用生成模型。",
      status: "completed",
    });
  });

  it("maps retrieval failures to a safe user-facing message", () => {
    expect(
      presentHistoricalAssistantAnswer(
        answer({
          status: "FAILED",
          answerText: "",
          errorCode: "query_embedding_auth_failed",
          errorMessage: "Request failed with status code 401",
        }),
      ),
    ).toEqual({
      content:
        "当前检索服务暂时不可用，无法完成知识库查询。请稍后重试；如果持续出现，请检查 Embedding API 配置。",
      status: "failed",
    });
  });

  it("maps grounding failures without exposing internal details", () => {
    expect(
      presentHistoricalAssistantAnswer(
        answer({
          status: "FAILED",
          answerText: "",
          errorCode: "grounding_failed",
          errorMessage: "citation marker [99] out of range",
        }),
      ),
    ).toEqual({
      content: "答案生成后未通过引用一致性检查，已阻止展示。请重新提问。",
      status: "failed",
    });
  });

  it("maps stream errors by code instead of one generic message", () => {
    expect(
      presentStreamError({
        type: "error",
        code: "retrieval_unavailable",
        message: "query_embedding_auth_failed",
      }),
    ).toEqual({
      content:
        "当前检索服务暂时不可用，无法完成知识库查询。请稍后重试；如果持续出现，请检查 Embedding API 配置。",
      status: "failed",
    });
  });
});
