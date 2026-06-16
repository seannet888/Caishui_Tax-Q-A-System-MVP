import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SourcePanel } from "../SourcePanel";
import type { PresentedCitation } from "@/lib/knowledge/citation-presentation";

describe("SourcePanel", () => {
  it("can render as a compact desktop citation rail without changing inline mobile panels", () => {
    const citation: PresentedCitation = {
      id: "citation-rail",
      chunkId: "chunk-rail",
      title: "研发费用加计扣除政策",
      sourceDocumentName: "official-rd-policy.pdf",
      answeredAt: "2026-06-14T07:00:00.000Z",
      evidenceExcerpt: "研发费用按照实际发生额在税前加计扣除。",
      isTruncated: false,
      includesTable: false,
      tableTruncated: false,
      snapshotContentHash: "hash-rail",
      status: "active",
      severity: "normal",
      badges: [],
      warnings: [],
    };

    const inlineHtml = renderToStaticMarkup(
      createElement(SourcePanel, { presentedCitations: [citation] }),
    );
    const stickyHtml = renderToStaticMarkup(
      createElement(SourcePanel, { presentedCitations: [citation], desktopRail: true }),
    );

    expect(inlineHtml).not.toContain("max-h-[calc(100vh-12rem)]");
    expect(stickyHtml).not.toContain("sticky");
    expect(stickyHtml).not.toContain("top-1/2");
    expect(stickyHtml).not.toContain("self-center");
    expect(stickyHtml).toContain("w-full");
    expect(stickyHtml).toContain("max-h-full");
    expect(stickyHtml).toContain("overflow-y-auto");
    expect(stickyHtml).toContain("overscroll-contain");
  });

  it("renders citation cards with source identity, audit metadata, and warning badges", () => {
    const html = renderToStaticMarkup(
      createElement(SourcePanel, {
        presentedCitations: [
          {
            id: "citation-1",
            chunkId: "chunk-1",
            docNumber: "财政部 税务总局公告2023年第7号",
            title: "关于进一步完善研发费用税前加计扣除政策的公告",
            sourceDocumentName: "official-rd-policy.pdf",
            sourceLocation: { page: 2, section: "第一条" },
            answeredAt: "2026-06-14T07:00:00.000Z",
            evidenceExcerpt: "研发费用按照实际发生额的100%在税前加计扣除。",
            isTruncated: false,
            includesTable: false,
            tableTruncated: false,
            snapshotContentHash: "hash-1234567890",
            status: "active",
            severity: "normal",
            badges: [],
            warnings: [],
          },
          {
            id: "citation-2",
            chunkId: "chunk-2",
            title: "地方口径补充说明",
            sourceDocumentName: "withdrawn-source.md",
            answeredAt: "2026-06-14T07:00:00.000Z",
            evidenceExcerpt: "该来源已撤出当前检索。",
            isTruncated: true,
            includesTable: true,
            tableTruncated: true,
            snapshotContentHash: "hash-withdrawn",
            status: "withdrawn",
            severity: "warning",
            badges: ["来源已撤出"],
            warnings: ["该引用来源已从当前知识库中移除"],
          },
        ] satisfies PresentedCitation[],
      }),
    );

    expect(html).toContain("引用来源");
    expect(html).toContain("2 条");
    expect(html).toContain("财政部 税务总局公告2023年第7号");
    expect(html).toContain("official-rd-policy.pdf");
    expect(html).toContain("第 2 页");
    expect(html).toContain("第一条");
    expect(html).toContain("hash-1234567890");
    expect(html).toContain("来源已撤出");
    expect(html).toContain("表格快照已截断");
    expect(html).toContain("[截断]");
  });
});
