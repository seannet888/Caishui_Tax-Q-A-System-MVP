import { describe, expect, it } from "vitest";
import { evaluateEvidencePolicy } from "@/lib/knowledge/evidence-policy";
import type { RetrievedEvidence } from "@/types/knowledge";

function evidence(
  id: string,
  overrides: Partial<RetrievedEvidence> = {},
): RetrievedEvidence {
  return {
    id,
    document_id: `doc-${id}`,
    content: "具体办法由国务院财政、税务主管部门另行制定。",
    content_hash: "a".repeat(64),
    chunk_type: "text",
    similarity: 0.9,
    distance: 0.1,
    title: "测试法规",
    source_document_name: "测试法规.pdf",
    authority_rank: 90,
    jurisdiction: "全国",
    doc_type: "regulation",
    provision_type: "delegating",
    answer_role: "authority_delegation",
    retrieval_execution: "primary",
    ...overrides,
  };
}

describe("evaluateEvidencePolicy", () => {
  it("地方敏感问题缺少管辖地时在检索前要求澄清", () => {
    const decision = evaluateEvidencePolicy({
      query: "社保缴费比例是多少？",
    });

    expect(decision).toEqual({
      action: "clarify",
      reason: "local_sensitive_query_requires_jurisdiction",
      question: "不同地区的标准可能不同，请问您需要了解哪个地区的政策？",
    });
  });

  it("非财税劳动合同问题在检索前返回无证据", () => {
    const decision = evaluateEvidencePolicy({
      query: "劳动者发生什么情况，用人单位可解除合同？",
    });

    expect(decision).toEqual({
      action: "no_evidence",
      assessment: {
        state: "NO_EVIDENCE",
        score: 0,
        reasons: ["non_tax_query_out_of_scope"],
      },
    });
  });

  it("仅有授权性条款时不得判定为充分政策证据", () => {
    const decision = evaluateEvidencePolicy({
      query: "研发费用加计扣除的具体办法是什么？",
      chunks: [evidence("1"), evidence("2"), evidence("3")],
    });

    expect(decision.action).toBe("generate");
    if (decision.action !== "generate") throw new Error("expected generate");
    expect(decision.assessment.state).toBe("LIMITED_EVIDENCE");
    expect(decision.assessment.reasons).toContain(
      "delegating_provisions_only",
    );
    expect(decision.promptDirectives.join("\n")).toContain(
      "当前检索证据未包含对应配套文件",
    );
  });

  it("仅有官方解读时强制按有限证据生成并说明不能替代原文", () => {
    const decision = evaluateEvidencePolicy({
      query: "研发费用加计扣除最新政策",
      chunks: [
        evidence("1", {
          doc_type: "interpretation",
          provision_type: "operative",
          answer_role: "substantive_rule",
          title: "研发费用加计扣除政策解读",
        }),
        evidence("2", {
          doc_type: "interpretation",
          provision_type: "operative",
          answer_role: "substantive_rule",
          title: "研发费用政策问答",
        }),
        evidence("3", {
          doc_type: "interpretation",
          provision_type: "operative",
          answer_role: "substantive_rule",
          title: "研发费用政策图解",
        }),
      ],
    });

    expect(decision.action).toBe("generate");
    if (decision.action !== "generate") throw new Error("expected generate");
    expect(decision.assessment.state).toBe("LIMITED_EVIDENCE");
    expect(decision.assessment.reasons).toContain(
      "official_interpretations_only",
    );
    expect(decision.promptDirectives.join("\n")).toContain(
      "未找到对应规范性原文",
    );
  });
});
