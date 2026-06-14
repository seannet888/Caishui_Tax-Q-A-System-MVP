// caishui-webapp/types/knowledge.ts
// 检索层内部类型。

/**
 * 一次检索命中的完整证据投影。
 * 同一份数据支持重排、覆盖证据、Prompt 和 Citation Snapshot，避免不同表示间漂移。
 */
export interface RetrievedEvidence {
  id: string;
  document_id: string;
  content: string;
  content_hash: string;
  chunk_type: string;
  similarity: number; // 0-1，越高越相似（= 1 - 余弦距离）
  distance: number; // pgvector <=> 余弦距离，越小越相似
  title: string;
  source_document_name: string;
  doc_number?: string;
  publish_date?: string;
  authority_rank?: number; // null/undefined 表示未知
  effective_date?: string;
  expire_date?: string;
  jurisdiction?: string;
  issuing_body?: string;
  source_channel?: string;
  doc_type?: string;
  provision_type: string;
  answer_role?: string;
  source_page?: number;
  source_section?: string;
  retrieval_execution: string;
  rerank_score?: number;
}

export type TemporalIntent =
  | "current_validity"
  | "as_of"
  | "publication_period"
  | "historical_comparison"
  | "current_applicability";

export type LatestIntent =
  | "current_effective_policy"
  | "latest_publication"
  | "latest_interpretation"
  | "rule_status";

export type RetrievalRankingMode = "effective_date" | "publish_date";

export type RetrievalExecution =
  | {
      id: "primary" | "current";
      temporalScope: "current";
    }
  | {
      id: "primary" | "historical";
      temporalScope: "as_of";
      asOf: string;
    }
  | {
      id: "primary";
      temporalScope: "publication_period";
      publicationStart: string;
      publicationEnd: string;
    }
  | {
      id: "primary";
      temporalScope: "unbounded";
    };

export interface QueryPlan {
  temporalIntent: TemporalIntent;
  latestIntent: LatestIntent;
  executions: RetrievalExecution[];
  rankingMode: RetrievalRankingMode;
  jurisdiction?: string;
  docTypeFilter?: "interpretation";
  effectivityLabelRequired: boolean;
  strictDateOrdering: boolean;
}

export type EvidenceSufficiency =
  | "NO_EVIDENCE"
  | "LIMITED_EVIDENCE"
  | "SUFFICIENT_EVIDENCE";

export interface EvidenceAssessment {
  state: EvidenceSufficiency;
  score: number;
  reasons: string[];
}

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

export type StandaloneQueryResult =
  | { status: "ready"; query: string; contextSnapshot: unknown }
  | { status: "needs_clarification"; question: string; contextSnapshot: unknown };

export interface CitationSnapshot {
  chunkId: string;
  chunkContentHash: string;
  docNumber?: string;
  title: string;
  evidenceExcerpt: string; // 最长 2,000 字符
  isTruncated: boolean;
  includesTable: boolean;
  tableTruncated: boolean;
  sourceLocation?: { page?: number; section?: string };
  sourceDocumentName: string;
  answeredAt: string;
}
