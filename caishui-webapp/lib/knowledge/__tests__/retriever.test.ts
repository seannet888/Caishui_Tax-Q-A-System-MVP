import { describe, expect, it } from "vitest";
import { retrieve } from "@/lib/knowledge/retriever";
import type { VectorSearchRow } from "@/lib/db/queries/chunks";
import type { RetrievalExecution } from "@/types/knowledge";

function row(overrides: Partial<VectorSearchRow> = {}): VectorSearchRow {
  return {
    id: "chunk-1",
    document_id: "document-1",
    content: "企业研发费用可按规定加计扣除。",
    content_hash: "hash-1",
    chunk_type: "text",
    distance: 0.18,
    similarity: -1,
    title: "关于进一步完善研发费用税前加计扣除政策的公告",
    source_document_name: "研发费用公告.pdf",
    doc_number: "财政部 税务总局公告2023年第7号",
    publish_date: new Date("2023-03-26T00:00:00.000Z"),
    authority_rank: 70,
    effective_date: new Date("2023-01-01T00:00:00.000Z"),
    expire_date: null,
    jurisdiction: "全国",
    issuing_body: "财政部、国家税务总局",
    source_channel: "国家税务总局官网",
    doc_type: "announcement",
    provision_type: "operative",
    answer_role: "substantive_rule",
    source_page: "1",
    source_section: "第一条",
    ...overrides,
  };
}

describe("retrieve", () => {
  it("默认检索当前有效材料，并把余弦距离转换为相似度", async () => {
    const executions: RetrievalExecution[] = [];

    const result = await retrieve(
      { query: "研发费用加计扣除政策是什么？" },
      {
        embedQuery: async () => Array.from({ length: 1024 }, () => 0),
        searchEligibleChunks: async (_embedding, _limit, execution) => {
          executions.push(execution);
          return [row()];
        },
      },
    );

    expect(executions).toEqual([
      { id: "primary", temporalScope: "current" },
    ]);
    expect(result.chunks[0]?.distance).toBe(0.18);
    expect(result.chunks[0]?.similarity).toBeCloseTo(0.82);
    expect(result.coverageEvidence.sourcesHit).toEqual([
      "国家税务总局官网",
    ]);
  });

  it("用户未指定管辖地时，全国性材料优先于地方材料", async () => {
    const result = await retrieve(
      { query: "研发费用加计扣除政策是什么？" },
      {
        embedQuery: async () => Array.from({ length: 1024 }, () => 0),
        searchEligibleChunks: async () => [
          row({
            id: "shanghai",
            jurisdiction: "上海市",
            distance: 0.05,
            similarity: 0.95,
            authority_rank: 90,
          }),
          row({
            id: "national",
            jurisdiction: "全国",
            distance: 0.2,
            similarity: 0.8,
            authority_rank: 70,
          }),
        ],
      },
    );

    expect(result.chunks.map((chunk) => chunk.id)).toEqual([
      "national",
      "shanghai",
    ]);
  });

  it("“最新发布”按发布日期降序，不让相似度覆盖时间语义", async () => {
    const result = await retrieve(
      { query: "最新发布的增值税政策" },
      {
        embedQuery: async () => Array.from({ length: 1024 }, () => 0),
        searchEligibleChunks: async (_embedding, _limit, execution) => {
          expect(execution).toEqual({
            id: "primary",
            temporalScope: "unbounded",
          });
          return [
            row({
              id: "older-more-similar",
              publish_date: new Date("2024-01-01T00:00:00.000Z"),
              distance: 0.01,
              similarity: 0.99,
              authority_rank: 100,
            }),
            row({
              id: "newer",
              publish_date: new Date("2026-05-01T00:00:00.000Z"),
              distance: 0.35,
              similarity: 0.65,
              authority_rank: 70,
            }),
          ];
        },
      },
    );

    expect(result.queryPlan.effectivityLabelRequired).toBe(true);
    expect(result.chunks.map((chunk) => chunk.id)).toEqual([
      "newer",
      "older-more-similar",
    ]);
  });

  it("“最新政策”先过滤当前有效材料，再按生效日期降序", async () => {
    const result = await retrieve(
      { query: "研发费用加计扣除最新政策" },
      {
        embedQuery: async () => Array.from({ length: 1024 }, () => 0),
        searchEligibleChunks: async (_embedding, _limit, execution) => {
          expect(execution.temporalScope).toBe("current");
          return [
            row({
              id: "older-more-similar",
              effective_date: new Date("2023-01-01T00:00:00.000Z"),
              distance: 0.01,
              similarity: 0.99,
              authority_rank: 100,
            }),
            row({
              id: "newer",
              effective_date: new Date("2025-01-01T00:00:00.000Z"),
              distance: 0.3,
              similarity: 0.7,
              authority_rank: 70,
            }),
          ];
        },
      },
    );

    expect(result.chunks.map((chunk) => chunk.id)).toEqual([
      "newer",
      "older-more-similar",
    ]);
  });
});
