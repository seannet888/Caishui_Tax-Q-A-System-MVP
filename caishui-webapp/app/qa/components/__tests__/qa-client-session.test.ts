import { describe, expect, it } from "vitest";
import {
  buildChatRequestBody,
  shouldApplyHydratedMessages,
} from "../qa-client-session";
import type { QaMessage } from "../history-hydration";

describe("QA Client Session Module", () => {
  it("applies hydrated history only while the active UI is empty", () => {
    const hydrated: QaMessage[] = [
      { role: "user", content: "历史问题", status: "completed" },
      { role: "assistant", content: "历史回答", status: "completed" },
    ];

    expect(shouldApplyHydratedMessages([], hydrated)).toBe(true);
    expect(
      shouldApplyHydratedMessages(
        [{ role: "user", content: "正在输入的问题" }],
        hydrated,
      ),
    ).toBe(false);
  });

  it("builds chat requests from the current conversation state", () => {
    const messages: QaMessage[] = [
      { role: "user", content: "研发费用加计扣除最新政策？" },
      { role: "assistant", content: "根据当前证据...", status: "completed" },
    ];

    expect(
      buildChatRequestBody({
        conversationId: "conv-1",
        question: "那上海呢？",
        messages,
      }),
    ).toEqual({
      conversationId: "conv-1",
      question: "那上海呢？",
      history: [
        { role: "user", content: "研发费用加计扣除最新政策？" },
        { role: "assistant", content: "根据当前证据..." },
      ],
    });
  });

  it("does not send unstable assistant messages in chat request history", () => {
    expect(
      buildChatRequestBody({
        conversationId: "conv-1",
        question: "继续",
        messages: [
          { role: "user", content: "研发费用加计扣除最新政策？" },
          { role: "assistant", content: "无状态草稿" },
          {
            role: "assistant",
            content: "答案生成后未通过引用一致性检查，已阻止展示。请重新提问。",
            status: "failed",
          },
          { role: "assistant", content: "根据当前证据...", status: "completed" },
        ],
      }),
    ).toEqual({
      conversationId: "conv-1",
      question: "继续",
      history: [
        { role: "user", content: "研发费用加计扣除最新政策？" },
        { role: "assistant", content: "根据当前证据..." },
      ],
    });
  });
});
