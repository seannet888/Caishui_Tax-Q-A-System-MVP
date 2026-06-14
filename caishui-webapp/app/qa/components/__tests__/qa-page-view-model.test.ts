import { describe, expect, it } from "vitest";
import {
  appendQueuedTurn,
  applyChatStreamEvent,
  markLastAssistantFailed,
  toConversationHistory,
} from "../qa-page-view-model";
import type { QaMessage } from "../history-hydration";

describe("QA page view model", () => {
  it("builds retrieval history from non-empty recent messages", () => {
    const messages: QaMessage[] = Array.from({ length: 12 }, (_, index) => ({
      role: index % 2 === 0 ? "user" : "assistant",
      content: index === 0 ? "   " : `message-${index}`,
      status: index % 2 === 0 ? undefined : "completed",
    }));

    expect(toConversationHistory(messages)).toEqual(
      Array.from({ length: 10 }, (_, offset) => {
        const index = offset + 2;
        return {
          role: index % 2 === 0 ? "user" : "assistant",
          content: `message-${index}`,
        };
      }),
    );
  });

  it("does not carry failed assistant audit records into retrieval history", () => {
    expect(
      toConversationHistory([
        { role: "user", content: "研发费用加计扣除最新政策" },
        {
          role: "assistant",
          content: "答案生成后未通过引用一致性检查，已阻止展示。请重新提问。",
          status: "failed",
        },
        { role: "user", content: "那上海呢？" },
      ]),
    ).toEqual([
      { role: "user", content: "研发费用加计扣除最新政策" },
      { role: "user", content: "那上海呢？" },
    ]);
  });

  it("does not carry in-flight assistant drafts into retrieval history", () => {
    expect(
      toConversationHistory([
        { role: "user", content: "研发费用加计扣除最新政策" },
        {
          role: "assistant",
          content: "根据已检索到的",
          status: "streaming",
        },
      ]),
    ).toEqual([{ role: "user", content: "研发费用加计扣除最新政策" }]);
  });

  it("appends a user question and queued assistant placeholder", () => {
    expect(appendQueuedTurn([], "研发费用加计扣除")).toEqual([
      { role: "user", content: "研发费用加计扣除" },
      { role: "assistant", content: "", status: "queued" },
    ]);
  });

  it("applies stream events to the last assistant message only", () => {
    const started = applyChatStreamEvent(
      [{ role: "assistant", content: "old", status: "queued" }],
      { type: "start" },
    );
    const streamed = applyChatStreamEvent(started, {
      type: "token",
      delta: "根据文件规定",
    });
    const done = applyChatStreamEvent(streamed, {
      type: "done",
      answerId: "answer-1",
    });

    expect(done).toEqual([
      {
        role: "assistant",
        content: "根据文件规定",
        status: "completed",
      },
    ]);
  });

  it("projects deterministic and error stream outcomes into safe UI messages", () => {
    const noEvidence = applyChatStreamEvent(
      [{ role: "assistant", content: "", status: "streaming" }],
      { type: "no_evidence", message: "当前知识库未收录到相关文件。" },
    );
    expect(noEvidence[0]).toMatchObject({
      status: "completed",
      content: "当前知识库未收录到相关文件。",
    });

    const failed = applyChatStreamEvent(
      [{ role: "assistant", content: "", status: "streaming" }],
      { type: "error", code: "query_embedding_timeout", message: "timeout" },
    );
    expect(failed[0]?.status).toBe("failed");
    expect(failed[0]?.content).toContain("当前检索服务暂时不可用");
    expect(failed[0]?.content).not.toContain("timeout");
  });

  it("marks only the last assistant message failed after transport errors", () => {
    expect(
      markLastAssistantFailed([
        { role: "user", content: "问题" },
        { role: "assistant", content: "", status: "streaming" },
      ]),
    ).toEqual([
      { role: "user", content: "问题" },
      { role: "assistant", content: "请求失败，请重试。", status: "failed" },
    ]);
  });
});
