import { describe, expect, it } from "vitest";
import { assessEvidence } from "@/lib/knowledge/evidence";
import type { RetrievedEvidence } from "@/types/knowledge";

function evidence(id: string): RetrievedEvidence {
  return {
    id,
    document_id: `document-${id}`,
    content: "财税政策证据内容",
    content_hash: `hash-${id}`,
    chunk_type: "text",
    similarity: 0.8,
    distance: 0.2,
    title: "政策文件",
    source_document_name: "政策文件.pdf",
    authority_rank: 50,
    jurisdiction: "全国",
    provision_type: "operative",
    retrieval_execution: "primary",
  };
}

describe("assessEvidence", () => {
  it("没有合格 chunk 时返回 NO_EVIDENCE", () => {
    expect(assessEvidence([])).toEqual({
      state: "NO_EVIDENCE",
      score: 0,
      reasons: ["no_eligible_chunks"],
    });
  });

  it("未指定管辖地时，三条普通层级材料仍属于有限证据", () => {
    const assessment = assessEvidence([
      evidence("1"),
      evidence("2"),
      evidence("3"),
    ]);

    expect(assessment.state).toBe("LIMITED_EVIDENCE");
    expect(assessment.reasons).toContain(
      "no_strong_authority_or_exact_jurisdiction",
    );
  });

  it("至少三条材料且含高权威依据时返回充分证据", () => {
    const assessment = assessEvidence([
      { ...evidence("1"), authority_rank: 70 },
      evidence("2"),
      evidence("3"),
    ]);

    expect(assessment.state).toBe("SUFFICIENT_EVIDENCE");
    expect(assessment.reasons).toEqual([]);
  });
});
