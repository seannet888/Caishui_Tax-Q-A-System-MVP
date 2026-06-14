import { describe, expect, it } from "vitest";
import {
  checkCitationGrounding,
  createCitationSnapshot,
} from "@/lib/knowledge/citation";
import type {
  CitationSnapshot,
  RetrievedEvidence,
} from "@/types/knowledge";

function snap(partial: Partial<CitationSnapshot>): CitationSnapshot {
  return {
    chunkId: "c" + "0".repeat(24),
    chunkContentHash: "a".repeat(64),
    title: "测试",
    evidenceExcerpt: "片段",
    isTruncated: false,
    includesTable: false,
    tableTruncated: false,
    sourceDocumentName: "来源.pdf",
    answeredAt: new Date().toISOString(),
    ...partial,
  };
}

describe("checkCitationGrounding", () => {
  it("接受合法的引用编号", () => {
    const result = checkCitationGrounding("依据[1]和[2]。", [snap({}), snap({})]);
    expect(result.ok).toBe(true);
    expect(result.usedCitationIndexes).toEqual([1, 2]);
  });

  it("拒绝越界引用编号", () => {
    const result = checkCitationGrounding("见[3]。", [snap({})]);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("invalid_citation_index:3");
  });

  it("拒绝 [0]", () => {
    const result = checkCitationGrounding("见[0]。", [snap({})]);
    expect(result.ok).toBe(false);
  });

  it("拒绝没有使用任何引用的正式答案", () => {
    const result = checkCitationGrounding(
      "研发费用可以按规定加计扣除。",
      [snap({ docNumber: "财税〔2023〕6号" })],
    );

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("missing_citation");
    expect(result.usedCitationIndexes).toEqual([]);
  });

  it("答案中出现的文号必须存在于某条 citation 的 docNumber", () => {
    const result = checkCitationGrounding("依据财税〔2023〕06号[1]。", [
      snap({ docNumber: "财税〔2023〕99号" }),
    ]);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.startsWith("unmatched_doc_number"))).toBe(true);
  });
});

describe("createCitationSnapshot", () => {
  it("从 Retrieved Evidence 固化来源身份和位置", () => {
    const evidence: RetrievedEvidence = {
      id: "c" + "1".repeat(24),
      document_id: "doc-1",
      content: "第一条 本办法自发布之日起施行。",
      content_hash: "b".repeat(64),
      chunk_type: "text",
      similarity: 0.91,
      distance: 0.09,
      title: "测试办法",
      source_document_name: "测试办法.pdf",
      doc_number: "财税〔2023〕6号",
      provision_type: "operative",
      source_page: 3,
      retrieval_execution: "primary",
    };

    const snapshot = createCitationSnapshot(
      evidence,
      new Date("2026-06-11T00:00:00.000Z"),
    );

    expect(snapshot.chunkId).toBe(evidence.id);
    expect(snapshot.chunkContentHash).toBe(evidence.content_hash);
    expect(snapshot.sourceLocation).toEqual({ page: 3, section: undefined });
    expect(snapshot.answeredAt).toBe("2026-06-11T00:00:00.000Z");
  });
});
