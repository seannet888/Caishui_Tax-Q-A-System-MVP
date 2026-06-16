// Evidence Policy Module：检索前澄清与检索后证据门控的唯一决策入口。

import type {
  EvidenceAssessment,
  EvidenceSufficiency,
  RetrievedEvidence,
} from "@/types/knowledge";
import { assessEvidence } from "@/lib/knowledge/evidence";
import { hasLocalSensitiveKeyword } from "@/lib/knowledge/rerank";

export type EvidencePolicyDecision =
  | {
      action: "clarify";
      reason: "local_sensitive_query_requires_jurisdiction";
      question: string;
    }
  | { action: "proceed" }
  | { action: "no_evidence"; assessment: EvidenceAssessment }
  | {
      action: "generate";
      assessment: EvidenceAssessment & {
        state: Exclude<EvidenceSufficiency, "NO_EVIDENCE">;
      };
      promptDirectives: string[];
    };

export function evaluateEvidencePolicy(input: {
  query: string;
  jurisdiction?: string;
  chunks?: RetrievedEvidence[];
}): EvidencePolicyDecision {
  if (!input.chunks && isNonTaxLaborLawQuery(input.query)) {
    return {
      action: "no_evidence",
      assessment: {
        state: "NO_EVIDENCE",
        score: 0,
        reasons: ["non_tax_query_out_of_scope"],
      },
    };
  }

  if (!input.jurisdiction && hasLocalSensitiveKeyword(input.query)) {
    return {
      action: "clarify",
      reason: "local_sensitive_query_requires_jurisdiction",
      question: "不同地区的标准可能不同，请问您需要了解哪个地区的政策？",
    };
  }

  if (!input.chunks) return { action: "proceed" };

  const assessment = assessEvidence(input.chunks, input.jurisdiction);
  if (assessment.state === "NO_EVIDENCE") {
    return { action: "no_evidence", assessment };
  }

  const delegatingOnly = input.chunks.every(
    (chunk) =>
      chunk.provision_type === "delegating" ||
      chunk.answer_role === "authority_delegation",
  );
  if (delegatingOnly) {
    return limited(
      assessment,
      "delegating_provisions_only",
      [
        "本次仅命中授权性条款。只能说明授权机关与授权事项，不得据此回答具体政策内容；必须明确说明：当前检索证据未包含对应配套文件，因此不能确认具体办法。",
      ],
    );
  }

  const interpretationOnly = input.chunks.every(
    (chunk) => chunk.doc_type === "interpretation",
  );
  if (interpretationOnly) {
    return limited(
      assessment,
      "official_interpretations_only",
      [
        "本次仅命中官方解读材料。必须明确说明：未找到对应规范性原文，以下为官方解读，仅供参考，具体以原始规范性文件为准。",
      ],
    );
  }
  if (!canGenerate(assessment)) {
    return { action: "no_evidence", assessment };
  }
  return { action: "generate", assessment, promptDirectives: [] };
}

function isNonTaxLaborLawQuery(query: string): boolean {
  const asksLaborContract =
    /劳动者|用人单位|劳动合同|解除合同|解除劳动关系|辞退|开除/.test(query);
  if (!asksLaborContract) return false;

  const hasTaxOrFinanceScope =
    /税|个税|个人所得税|社保|公积金|补偿金|赔偿金|工资薪金|扣除|发票|增值税|企业所得税/.test(
      query,
    );
  return !hasTaxOrFinanceScope;
}

function limited(
  assessment: EvidenceAssessment,
  reason: string,
  promptDirectives: string[],
): Extract<EvidencePolicyDecision, { action: "generate" }> {
  return {
    action: "generate",
    assessment: {
      ...assessment,
      state: "LIMITED_EVIDENCE",
      reasons: [
        ...assessment.reasons.filter((item) => item !== reason),
        reason,
      ],
    },
    promptDirectives,
  };
}

function canGenerate(
  assessment: EvidenceAssessment,
): assessment is EvidenceAssessment & {
  state: Exclude<EvidenceSufficiency, "NO_EVIDENCE">;
} {
  return assessment.state !== "NO_EVIDENCE";
}
