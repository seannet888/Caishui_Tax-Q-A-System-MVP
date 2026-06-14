import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DocumentReviewHeader } from "../DocumentReviewHeader";

describe("DocumentReviewHeader", () => {
  it("renders document identity, lifecycle summary, and failure visibility", () => {
    const html = renderToStaticMarkup(
      createElement(DocumentReviewHeader, {
        document: {
          id: "doc-1",
          title: "研发费用加计扣除通知",
          docNumber: "财税〔2026〕1号",
          processingStatus: "FAILED",
          retrievalStatus: "RETRIEVABLE",
          errorMessage: "pipeline_rejected:500",
          publishDate: new Date("2026-01-01T00:00:00.000Z"),
          effectiveDate: new Date("2026-02-01T00:00:00.000Z"),
          lifecycle: {
            retrievalState: "failed",
            summary: "来源处理失败，当前不会产生可检索 chunk",
            readyChunkCount: 0,
            blockedChunkCount: 2,
            unverifiedChunkCount: 0,
            canWithdraw: true,
            canRestore: false,
          },
        },
        lifecycle: {
          title: "处理失败",
          toneClassName:
            "border-[#f2c3c5] bg-[color:var(--cs-danger-bg)] text-[color:var(--cs-danger)]",
          summary: "来源处理失败，当前不会产生可检索 chunk",
          actionHint: "请先处理上传或清洗失败原因。",
          counts: ["已就绪：0", "未就绪：2", "待核验：0"],
        },
      }),
    );

    expect(html).toContain("研发费用加计扣除通知");
    expect(html).toContain("财税〔2026〕1号");
    expect(html).toContain("FAILED");
    expect(html).toContain("RETRIEVABLE");
    expect(html).toContain("发布：2026-01-01");
    expect(html).toContain("生效：2026-02-01");
    expect(html).toContain("失败原因：pipeline_rejected:500");
    expect(html).toContain("已就绪：0");
    expect(html).toContain("未就绪：2");
    expect(html).toContain("待核验：0");
    expect(html).toContain("bg-[color:var(--cs-surface)]");
  });
});
