import { describe, expect, it } from "vitest";
import { generateStandaloneQuery } from "@/lib/knowledge/standalone-query";
import type { ConversationTurn } from "@/types/knowledge";

describe("generateStandaloneQuery", () => {
  it("将地域追问改写为带历史主题的独立检索查询", () => {
    const history: ConversationTurn[] = [
      {
        role: "user",
        content: "研发费用加计扣除的最新政策是什么？",
      },
      {
        role: "assistant",
        content: "以下按当前有效政策回答。",
      },
    ];

    const result = generateStandaloneQuery(history, "那上海呢？");

    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.query).toBe("上海市 研发费用加计扣除 当前适用政策");
      expect(result.contextSnapshot).toEqual(history);
    }
  });

  it("上下文不足时要求澄清而不是猜测主题", () => {
    const result = generateStandaloneQuery([], "那呢？");

    expect(result.status).toBe("needs_clarification");
    if (result.status === "needs_clarification") {
      expect(result.question).toBe("请问您指的是哪项政策或税务事项？");
      expect(result.contextSnapshot).toEqual([]);
    }
  });

  it("只使用最近五条上下文生成检索查询", () => {
    const history: ConversationTurn[] = [
      { role: "user", content: "企业所得税优惠的最新政策是什么？" },
      { role: "assistant", content: "旧回答" },
      { role: "assistant", content: "收到" },
      { role: "assistant", content: "继续" },
      { role: "assistant", content: "请补充" },
      { role: "assistant", content: "仍然没有主题" },
    ];

    const result = generateStandaloneQuery(history, "那上海呢？");

    expect(result.status).toBe("needs_clarification");
    expect(result.contextSnapshot).toEqual(history.slice(-5));
  });
});
