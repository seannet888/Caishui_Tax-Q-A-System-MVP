import { describe, expect, it } from "vitest";
import {
  presentChunkReadiness,
  presentDocumentLifecycle,
} from "@/app/docs/components/document-review-presenter";

describe("document review presenter", () => {
  it("projects a retrievable document lifecycle into an actionable status card", () => {
    expect(
      presentDocumentLifecycle({
        retrievalState: "retrievable",
        summary: "当前来源可被默认检索召回：2 个 chunk 已就绪，1 个尚未就绪",
        readyChunkCount: 2,
        blockedChunkCount: 1,
        unverifiedChunkCount: 1,
        canWithdraw: true,
        canRestore: false,
      }),
    ).toEqual({
      title: "检索状态正常",
      toneClassName:
        "border-[#cfe8de] bg-[color:var(--cs-success-bg)] text-[#1f8a5b]",
      summary: "当前来源可被默认检索召回：2 个 chunk 已就绪，1 个尚未就绪",
      actionHint: "新回答可以引用已就绪 chunk；未就绪 chunk 仍需核验或完成向量化。",
      counts: ["已就绪：2", "未就绪：1", "待核验：1"],
    });
  });

  it("projects withdrawn documents as restorable but not retrievable", () => {
    expect(
      presentDocumentLifecycle({
        retrievalState: "withdrawn",
        summary: "来源已撤出当前检索，新回答不会引用该来源",
        readyChunkCount: 0,
        blockedChunkCount: 3,
        unverifiedChunkCount: 0,
        canWithdraw: false,
        canRestore: true,
      }),
    ).toMatchObject({
      title: "已撤出检索",
      toneClassName:
        "border-[#f0dca8] bg-[color:var(--cs-warning-bg)] text-[color:var(--cs-warning)]",
      actionHint: "新回答不会引用该来源；如确认可重新使用，可填写原因后恢复检索。",
    });
  });

  it("projects chunk readiness with severity-specific labels", () => {
    expect(
      presentChunkReadiness({
        retrievalReadiness: "ready",
        readinessMessage: null,
      }),
    ).toEqual({
      label: "可检索",
      message: null,
      toneClassName:
        "border-[#cfe8de] bg-[color:var(--cs-success-bg)] text-[#1f8a5b]",
    });

    expect(
      presentChunkReadiness({
        retrievalReadiness: "blocked",
        readinessMessage: "已核验，但 embedding 尚未完成，默认检索不会召回该 chunk",
      }),
    ).toEqual({
      label: "检索阻塞",
      message: "已核验，但 embedding 尚未完成，默认检索不会召回该 chunk",
      toneClassName:
        "border-[#f0dca8] bg-[color:var(--cs-warning-bg)] text-[color:var(--cs-warning)]",
    });
  });
});
