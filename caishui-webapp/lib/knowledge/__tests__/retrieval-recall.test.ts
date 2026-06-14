import { describe, expect, it } from "vitest";
import { retrieve } from "@/lib/knowledge/retriever";
import type { VectorSearchRow } from "@/lib/db/queries/chunks";

function row(
  id: string,
  overrides: Partial<VectorSearchRow> = {},
): VectorSearchRow {
  return {
    id,
    document_id: `document-${id}`,
    content: `证据 ${id}`,
    content_hash: `hash-${id}`,
    chunk_type: "text",
    distance: 0.2,
    similarity: 0.8,
    title: `政策 ${id}`,
    source_document_name: `${id}.pdf`,
    doc_number: null,
    publish_date: new Date("2024-01-01T00:00:00.000Z"),
    authority_rank: 50,
    effective_date: new Date("2024-01-01T00:00:00.000Z"),
    expire_date: null,
    jurisdiction: "全国",
    issuing_body: "国家税务总局",
    source_channel: "国家税务总局官网",
    doc_type: "announcement",
    provision_type: "operative",
    answer_role: "substantive_rule",
    source_page: null,
    source_section: null,
    ...overrides,
  };
}

describe("retrieval top-3 recall regression", () => {
  it("标注协议样例的 expected chunk 命中率不低于 90%", async () => {
    const cases = [
      {
        query: "研发费用加计扣除政策",
        expected: "national",
        candidates: [
          row("local", { jurisdiction: "上海市", distance: 0.01 }),
          row("national", { jurisdiction: "全国", distance: 0.2 }),
        ],
      },
      {
        query: "上海市研发费用加计扣除政策",
        jurisdiction: "上海",
        expected: "shanghai",
        candidates: [
          row("national-2", { jurisdiction: "全国", distance: 0.01 }),
          row("shanghai", { jurisdiction: "上海市", distance: 0.35 }),
        ],
      },
      {
        query: "企业所得税优惠政策",
        expected: "high-authority",
        candidates: [
          row("similar-1", { distance: 0.05, authority_rank: 30 }),
          row("similar-2", { distance: 0.06, authority_rank: 30 }),
          row("similar-3", { distance: 0.07, authority_rank: 30 }),
          row("high-authority", { distance: 0.35, authority_rank: 100 }),
        ],
      },
      {
        query: "最新发布的增值税政策",
        expected: "newest-published",
        candidates: [
          row("older-published", {
            publish_date: new Date("2024-01-01T00:00:00.000Z"),
            distance: 0.01,
          }),
          row("newest-published", {
            publish_date: new Date("2026-01-01T00:00:00.000Z"),
            distance: 0.4,
          }),
        ],
      },
      {
        query: "增值税最新政策",
        expected: "newest-effective",
        candidates: [
          row("older-effective", {
            effective_date: new Date("2023-01-01T00:00:00.000Z"),
            distance: 0.01,
          }),
          row("newest-effective", {
            effective_date: new Date("2025-01-01T00:00:00.000Z"),
            distance: 0.4,
          }),
        ],
      },
    ];

    let hits = 0;
    for (const sample of cases) {
      const result = await retrieve(
        {
          query: sample.query,
          jurisdiction: sample.jurisdiction,
        },
        {
          embedQuery: async () => Array.from({ length: 1024 }, () => 0),
          searchEligibleChunks: async () => sample.candidates,
        },
      );
      if (result.chunks.slice(0, 3).some((chunk) => chunk.id === sample.expected)) {
        hits += 1;
      }
    }

    expect(hits / cases.length).toBeGreaterThanOrEqual(0.9);
  });
});
