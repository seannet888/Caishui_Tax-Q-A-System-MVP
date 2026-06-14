// lib/knowledge/citation.ts
// Citation Snapshot 写入校验 + Citation Grounding Check。
// MVP 校验只保证引用结构和文号映射一致，不宣称完成语义级断言核验或法律审查。

import type {
  CitationSnapshot,
  RetrievedEvidence,
} from "@/types/knowledge";

export const MAX_EVIDENCE_EXCERPT_LENGTH = 2000;

function truncateAtSemanticBoundary(content: string): {
  text: string;
  isTruncated: boolean;
} {
  if (content.length <= MAX_EVIDENCE_EXCERPT_LENGTH) {
    return { text: content, isTruncated: false };
  }

  const candidate = content.slice(0, MAX_EVIDENCE_EXCERPT_LENGTH - 4);
  const boundary = Math.max(
    candidate.lastIndexOf("\n"),
    candidate.lastIndexOf("。"),
    candidate.lastIndexOf("；"),
  );
  const text = (boundary >= 1000 ? candidate.slice(0, boundary + 1) : candidate)
    .trimEnd();
  return { text: `${text}[截断]`, isTruncated: true };
}

/** 从模型实际收到的 Retrieved Evidence 创建不可变 Citation Snapshot。 */
export function createCitationSnapshot(
  evidence: RetrievedEvidence,
  answeredAt = new Date(),
): CitationSnapshot {
  const excerpt = truncateAtSemanticBoundary(evidence.content);
  const includesTable =
    evidence.chunk_type === "table" ||
    (evidence.content.includes("|") && /\|.*\|/.test(evidence.content));

  return {
    chunkId: evidence.id,
    chunkContentHash: evidence.content_hash,
    docNumber: evidence.doc_number,
    title: evidence.title,
    evidenceExcerpt: excerpt.text,
    isTruncated: excerpt.isTruncated,
    includesTable,
    tableTruncated: includesTable && excerpt.isTruncated,
    sourceLocation:
      evidence.source_page || evidence.source_section
        ? {
            page: evidence.source_page,
            section: evidence.source_section,
          }
        : undefined,
    sourceDocumentName: evidence.source_document_name,
    answeredAt: answeredAt.toISOString(),
  };
}

/**
 * Citation Snapshot 写入前的运行时校验。禁止将任意对象直接写入 snapshot。
 * 这里的 chunkId 是 KnowledgeChunk.id（CUID），不是 pipeline 的 SHA-256 chunk_id。
 */
export function assertCitationSnapshot(value: CitationSnapshot): void {
  if (
    typeof value.chunkId !== "string" ||
    value.chunkId.length < 20 ||
    !value.chunkId.startsWith("c") ||
    !/^[a-f0-9]{64}$/i.test(value.chunkContentHash)
  ) {
    throw new Error("invalid_citation_identity");
  }
  if (!value.title.trim() || !value.sourceDocumentName.trim()) {
    throw new Error("missing_citation_source");
  }
  if (
    !value.evidenceExcerpt.trim() ||
    value.evidenceExcerpt.length > MAX_EVIDENCE_EXCERPT_LENGTH
  ) {
    throw new Error("invalid_evidence_excerpt");
  }
  if (value.tableTruncated && !value.includesTable) {
    throw new Error("invalid_table_flags");
  }
  if (Number.isNaN(Date.parse(value.answeredAt))) {
    throw new Error("invalid_answered_at");
  }
}

export interface GroundingResult {
  ok: boolean;
  errors: string[];
  usedCitationIndexes: number[];
}

/**
 * 执行时机：模型返回完整文本之后、正式答案和 Citation Snapshots 原子提交之前。
 */
export function checkCitationGrounding(
  answerText: string,
  citations: CitationSnapshot[],
): GroundingResult {
  const indexes = Array.from(answerText.matchAll(/\[(\d+)\]/g)).map((match) =>
    Number(match[1]),
  );
  const errors: string[] = [];

  if (indexes.length === 0) {
    errors.push("missing_citation");
  }

  for (const index of indexes) {
    if (index < 1 || index > citations.length) {
      errors.push(`invalid_citation_index:${index}`);
    }
  }

  const citedDocNumbers = new Set(
    citations.map((c) => c.docNumber).filter((v): v is string => Boolean(v)),
  );
  const mentionedDocNumbers = Array.from(
    answerText.matchAll(
      /(?:财税〔\d{4}〕\d+号|国家税务总局公告\d{4}年第\d+号)/g,
    ),
  ).map((match) => match[0]);

  for (const docNumber of mentionedDocNumbers) {
    if (!citedDocNumbers.has(docNumber)) {
      errors.push(`unmatched_doc_number:${docNumber}`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    usedCitationIndexes: Array.from(new Set(indexes)).sort((a, b) => a - b),
  };
}
