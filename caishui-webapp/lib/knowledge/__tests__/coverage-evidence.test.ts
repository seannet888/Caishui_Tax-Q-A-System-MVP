import { describe, expect, it } from "vitest";
import { generateRetrievalCoverageEvidence } from "@/lib/knowledge/coverage-evidence";
import type { RetrievedEvidence } from "@/types/knowledge";

function evidence(
  partial: Partial<RetrievedEvidence> = {},
): RetrievedEvidence {
  return {
    id: "chunk-1",
    document_id: "doc-1",
    content: "测试内容",
    content_hash: "a".repeat(64),
    chunk_type: "text",
    similarity: 0.9,
    distance: 0.1,
    title: "测试政策",
    source_document_name: "test.pdf",
    provision_type: "operative",
    retrieval_execution: "primary",
    ...partial,
  };
}

describe("generateRetrievalCoverageEvidence", () => {
  it("直接从 Retrieved Evidence 汇总真实来源、日期和类型", () => {
    const result = generateRetrievalCoverageEvidence([
      evidence({
        source_channel: "国家税务总局官网",
        publish_date: "2024-01-02T00:00:00.000Z",
        doc_type: "ANNOUNCEMENT",
      }),
      evidence({
        id: "chunk-2",
        source_channel: "财政部官网",
        publish_date: "2025-03-04T00:00:00.000Z",
        doc_type: "NOTICE",
      }),
    ]);

    expect(result.sourcesHit).toEqual(["国家税务总局官网", "财政部官网"]);
    expect(result.dateRange).toEqual({
      min: "2024-01-02",
      max: "2025-03-04",
    });
    expect(result.documentTypesHit).toEqual(["ANNOUNCEMENT", "NOTICE"]);
    expect(result).not.toHaveProperty("sourcesNotRepresentedInResults");
  });
});
