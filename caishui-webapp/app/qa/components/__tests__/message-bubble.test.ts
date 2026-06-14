import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MessageBubble } from "../MessageBubble";

describe("MessageBubble", () => {
  it("renders assistant messages with status labels and evidence-card styling", () => {
    const html = renderToStaticMarkup(
      createElement(MessageBubble, {
        role: "assistant",
        content: "当前知识库未检索到相关证据。",
        status: "completed",
        meta: {
          answerId: "answer-1",
          model: "deepseek-chat",
          promptTemplateVersion: "v1",
          retrievalQuery: null,
          deterministicReason: "no_evidence",
          startedAt: "2026-06-14T07:00:00.000Z",
          completedAt: "2026-06-14T07:00:00.000Z",
        },
      }),
    );

    expect(html).toContain("税");
    expect(html).toContain("无证据确定性模板");
    expect(html).toContain("当前知识库未检索到相关证据。");
    expect(html).toContain("模型：deepseek-chat");
    expect(html).toContain("rounded-xl");
    expect(html).toContain("border-[color:var(--cs-border)]");
    expect(html).toContain("bg-white");
  });

  it("renders user questions as the blue right-aligned bubble", () => {
    const html = renderToStaticMarkup(
      createElement(MessageBubble, {
        role: "user",
        content: "研发费用加计扣除当前政策是什么？",
      }),
    );

    expect(html).toContain("justify-end");
    expect(html).toContain("bg-[color:var(--cs-primary-dark)]");
    expect(html).toContain("研发费用加计扣除当前政策是什么？");
  });
});
