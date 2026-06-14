import { describe, expect, it } from "vitest";
import {
  loadConversationHistory,
  resolveConversationHistory,
} from "@/lib/knowledge/conversation-history";

describe("loadConversationHistory", () => {
  it("从已完成答案还原最近会话历史并排除失败草稿", async () => {
    const history = await loadConversationHistory(
      {
        answer: {
          findMany: async () => [
            {
              original_question: "那上海呢？",
              answer_text: "上海市另有执行口径。",
            },
            {
              original_question: "这条失败了吗？",
              answer_text: null,
            },
            {
              original_question: "研发费用加计扣除的最新政策是什么？",
              answer_text: "以下按当前有效政策回答。",
            },
          ],
        },
      },
      "conversation-1",
      { maxTurns: 4 },
    );

    expect(history).toEqual([
      { role: "user", content: "研发费用加计扣除的最新政策是什么？" },
      { role: "assistant", content: "以下按当前有效政策回答。" },
      { role: "user", content: "那上海呢？" },
      { role: "assistant", content: "上海市另有执行口径。" },
    ]);
  });

  it("优先使用服务端历史，服务端为空时回退到请求历史", async () => {
    const store = {
      answer: {
        findMany: async () => [
          {
            original_question: "研发费用加计扣除的最新政策是什么？",
            answer_text: "以下按当前有效政策回答。",
          },
        ],
      },
    };
    const fallback = [{ role: "user" as const, content: "前端内存里的旧问题" }];

    await expect(
      resolveConversationHistory(store, "conversation-1", fallback),
    ).resolves.toEqual([
      { role: "user", content: "研发费用加计扣除的最新政策是什么？" },
      { role: "assistant", content: "以下按当前有效政策回答。" },
    ]);

    await expect(
      resolveConversationHistory(
        { answer: { findMany: async () => [] } },
        "conversation-2",
        fallback,
      ),
    ).resolves.toEqual(fallback);
  });
});
