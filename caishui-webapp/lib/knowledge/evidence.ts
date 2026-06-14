// lib/knowledge/evidence.ts
// 证据充分性门控：调用 DeepSeek 前判断 Evidence Sufficiency。
// 不得用单一未校准的相似度阈值；阈值必须由标注测试集校准。

import type {
  EvidenceAssessment,
  RetrievedEvidence,
} from "@/types/knowledge";

const configuredEvidenceThreshold = Number(
  process.env.EVIDENCE_SUFFICIENT_THRESHOLD ?? "0.55",
);

if (
  !Number.isFinite(configuredEvidenceThreshold) ||
  configuredEvidenceThreshold < 0 ||
  configuredEvidenceThreshold > 1
) {
  throw new Error("EVIDENCE_SUFFICIENT_THRESHOLD must be between 0 and 1");
}

// 0.55 仅为原型初始值；生产值必须由标注测试集校准。
export const EVIDENCE_SUFFICIENT_THRESHOLD = configuredEvidenceThreshold;

export function assessEvidence(
  chunks: RetrievedEvidence[],
  queryJurisdiction?: string,
): EvidenceAssessment {
  if (chunks.length === 0) {
    return { state: "NO_EVIDENCE", score: 0, reasons: ["no_eligible_chunks"] };
  }

  const averageScore =
    chunks.reduce((total, chunk) => {
      const authority = (chunk.authority_rank ?? 50) / 100;
      const jurisdiction = !queryJurisdiction
        ? 0.8
        : chunk.jurisdiction?.includes(queryJurisdiction)
          ? 1
          : chunk.jurisdiction === "全国"
            ? 0.75
            : 0.4;
      return total + authority * 0.6 + jurisdiction * 0.4;
    }, 0) / chunks.length;

  const hasStrongAuthority = chunks.some((c) => (c.authority_rank ?? 0) >= 70);
  const hasExactJurisdiction = Boolean(
    queryJurisdiction &&
      chunks.some((c) => c.jurisdiction?.includes(queryJurisdiction)),
  );

  // 以下数值仅为初始实验参数，必须通过标注测试集校准后才能用于生产。
  if (chunks.length < 3 || averageScore < EVIDENCE_SUFFICIENT_THRESHOLD) {
    return {
      state: "LIMITED_EVIDENCE",
      score: averageScore,
      reasons: ["insufficient_quantity_or_quality"],
    };
  }

  return {
    state:
      hasStrongAuthority || hasExactJurisdiction
        ? "SUFFICIENT_EVIDENCE"
        : "LIMITED_EVIDENCE",
    score: averageScore,
    reasons:
      hasStrongAuthority || hasExactJurisdiction
        ? []
        : ["no_strong_authority_or_exact_jurisdiction"],
  };
}

export const NO_EVIDENCE_TEMPLATE =
  "根据本次检索覆盖证据，当前知识库未检索到与您问题直接相关的已核验材料。" +
  "这不代表相关文件不存在或尚未发布，建议访问对应主管机关官方网站核实。";

export const LIMITED_EVIDENCE_PROMPT =
  "以下回答仅基于有限的已核验材料，可能不完整。只能总结所提供资料，" +
  "不得补充资料之外的税率、期限、条件或结论，并须明确建议用户核对官方文件。";
