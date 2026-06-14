import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChunkPreview } from "../ChunkPreview";

describe("ChunkPreview", () => {
  it("renders preview chunks as compact evidence cards", () => {
    const html = renderToStaticMarkup(
      createElement(ChunkPreview, {
        chunks: [
          {
            chunk_id: "chunk-1",
            document_id: "doc-1",
            chunk_index: 1,
            chunk_type: "text",
            content: "第一条 研发费用加计扣除政策内容。",
            content_hash:
              "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            embedding: null,
            embedding_model: null,
            metadata: {
              doc_number: "财税〔2026〕1号",
              effective_date: "2026-01-01",
              source_channel: "国家税务总局官网",
              jurisdiction: "全国",
              is_expired: false,
              has_table: false,
              has_formula: false,
            },
            created_at: "2026-06-14T00:00:00.000Z",
          },
        ],
      }),
    );

    expect(html).toContain("Chunk 1");
    expect(html).toContain("text");
    expect(html).toContain("财税〔2026〕1号");
    expect(html).toContain("国家税务总局官网");
    expect(html).toContain("全国");
    expect(html).toContain("bg-[#f7fbfe]");
  });
});
