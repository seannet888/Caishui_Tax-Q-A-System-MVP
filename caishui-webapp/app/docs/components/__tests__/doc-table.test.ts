import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DocTable } from "../DocTable";

describe("DocTable", () => {
  it("renders an empty document library state with an upload entry point", () => {
    const html = renderToStaticMarkup(
      createElement(DocTable, {
        documents: [],
      }),
    );

    expect(html).toContain("暂无来源文档");
    expect(html).toContain("上传来源文档");
    expect(html).toContain("/admin/upload");
    expect(html).toContain("bg-[color:var(--cs-surface)]");
  });

  it("shows upload or pipeline failure reason for failed source documents", () => {
    const html = renderToStaticMarkup(
      createElement(DocTable, {
        documents: [
          {
            id: "doc-failed",
            title: "失败上传文件",
            file_name: "failed.md",
            file_type: "MD",
            file_path: null,
            file_size: 42,
            file_hash: "hash",
            processing_status: "FAILED",
            retrieval_status: "RETRIEVABLE",
            error_message: "pipeline_rejected:500:Internal Server Error",
            doc_type: "NOTICE",
            doc_number: null,
            publish_date: null,
            effective_date: null,
            expire_date: null,
            jurisdiction: "全国",
            issuing_body: "国家税务总局",
            source_channel: "live-handshake",
            authority_rank: null,
            created_at: new Date("2026-06-13T00:00:00.000Z"),
            updated_at: new Date("2026-06-13T00:00:00.000Z"),
            processed_at: null,
          },
        ],
      }),
    );

    expect(html).toContain("失败原因");
    expect(html).toContain("pipeline_rejected:500:Internal Server Error");
  });

  it("marks withdrawn documents as audit-retained and visually muted", () => {
    const html = renderToStaticMarkup(
      createElement(DocTable, {
        documents: [
          {
            id: "doc-withdrawn",
            title: "已撤出文件",
            file_name: "withdrawn.md",
            file_type: "MD",
            file_path: null,
            file_size: 42,
            file_hash: "hash-withdrawn",
            processing_status: "COMPLETED",
            retrieval_status: "WITHDRAWN",
            error_message: null,
            doc_type: "NOTICE",
            doc_number: "财税〔2026〕2号",
            publish_date: new Date("2026-01-01T00:00:00.000Z"),
            effective_date: null,
            expire_date: null,
            jurisdiction: "全国",
            issuing_body: "国家税务总局",
            source_channel: "国家税务总局官网",
            authority_rank: null,
            created_at: new Date("2026-06-13T00:00:00.000Z"),
            updated_at: new Date("2026-06-13T00:00:00.000Z"),
            processed_at: null,
          },
        ],
      }),
    );

    expect(html).toContain("已撤出当前检索");
    expect(html).toContain("bg-[#f8fbfd]");
    expect(html).toContain("国家税务总局官网");
    expect(html).toContain("全国");
  });

});
