// lib/knowledge/retriever.ts
// 向量检索器：执行 Query Plan，返回完整 Retrieved Evidence 与覆盖证据。
// ⚠️ Effective Applicability 是硬约束，不是可选项。禁止在未明确用户意图的情况下移除。
// 链路要求：返回 chunks 时必须同时返回 coverageEvidence。

import { DocType, Prisma } from "@prisma/client";
import type {
  QueryPlan,
  RetrievedEvidence,
  RetrievalExecution,
} from "@/types/knowledge";
import { searchByVector } from "@/lib/db/queries/chunks";
import { createEmbeddings } from "@/lib/knowledge/stream-handler";
import { buildExecutionFilter } from "@/lib/knowledge/temporal";
import { rerankByAuthority } from "@/lib/knowledge/rerank";
import { buildQueryPlan } from "@/lib/knowledge/query-plan";
import {
  generateRetrievalCoverageEvidence,
  type RetrievalCoverageEvidence,
} from "@/lib/knowledge/coverage-evidence";

const RECALL_LIMIT = 30; // 向量召回 top-30
const FINAL_LIMIT = 5; // 应用层重排取 top-5

export interface RetrievalResult {
  chunks: RetrievedEvidence[];
  coverageEvidence: RetrievalCoverageEvidence;
  queryPlan: QueryPlan;
}

export interface RetrievalDependencies {
  embedQuery(query: string): Promise<number[]>;
  searchEligibleChunks(
    queryEmbedding: number[],
    limit: number,
    execution: RetrievalExecution,
    docTypeFilter?: QueryPlan["docTypeFilter"],
  ): Promise<Awaited<ReturnType<typeof searchByVector>>>;
}

async function embedQueryWithProvider(query: string): Promise<number[]> {
  const data = await createEmbeddings([query]);
  // OpenAI 兼容协议：data.data[0].embedding（硅基流动 bge-large-zh-v1.5，1024维）
  const embedding: number[] | undefined = data?.data?.[0]?.embedding;
  if (!embedding || embedding.length !== 1024) {
    throw new Error("query_embedding_failed");
  }
  return embedding;
}

const productionDependencies: RetrievalDependencies = {
  embedQuery: embedQueryWithProvider,
  async searchEligibleChunks(
    queryEmbedding,
    limit,
    execution,
    requestedDocType,
  ) {
    const temporalFilter = buildExecutionFilter(execution);
    const docTypeFilter =
      requestedDocType === "interpretation"
        ? Prisma.sql`AND kc.doc_type = ${DocType.INTERPRETATION}::"DocType"`
        : Prisma.empty;
    return searchByVector(
      queryEmbedding,
      limit,
      Prisma.sql`${temporalFilter} ${docTypeFilter}`,
    );
  },
};

/**
 * 检索入口。queryDate 仅在 as_of 意图下需要（YYYY-MM-DD）。
 * coverageEvidence 由检索结果动态生成；与 chunks 一同返回，供 prompt 与审计使用。
 */
export async function retrieve(
  params: {
    query: string;
    jurisdiction?: string;
    queryDate?: string;
  },
  dependencies: RetrievalDependencies = productionDependencies,
): Promise<RetrievalResult> {
  const { query, jurisdiction, queryDate } = params;
  const queryPlan = buildQueryPlan({ query, jurisdiction, queryDate });

  const queryEmbedding = await dependencies.embedQuery(query);
  const executionResults = await Promise.all(
    queryPlan.executions.map((execution) =>
      executeRetrieval(queryEmbedding, queryPlan, execution, dependencies),
    ),
  );
  const chunks = executionResults.flat();
  const coverageEvidence = generateRetrievalCoverageEvidence(chunks);

  return { chunks, coverageEvidence, queryPlan };
}

async function executeRetrieval(
  queryEmbedding: number[],
  plan: QueryPlan,
  execution: RetrievalExecution,
  dependencies: RetrievalDependencies,
): Promise<RetrievedEvidence[]> {
  // 管辖地不参与 SQL 召回（ADR-0004）；仅在应用层做本地优先 + 全国兜底。
  const rows = await dependencies.searchEligibleChunks(
    queryEmbedding,
    RECALL_LIMIT,
    execution,
    plan.docTypeFilter,
  );
  const candidates: RetrievedEvidence[] = rows.map((row) => ({
    id: row.id,
    document_id: row.document_id,
    content: row.content,
    content_hash: row.content_hash,
    chunk_type: row.chunk_type,
    similarity: 1 - row.distance,
    distance: row.distance,
    title: row.title,
    source_document_name: row.source_document_name,
    doc_number: row.doc_number ?? undefined,
    publish_date: row.publish_date?.toISOString(),
    authority_rank: row.authority_rank ?? undefined,
    effective_date: row.effective_date?.toISOString(),
    expire_date: row.expire_date?.toISOString(),
    jurisdiction: row.jurisdiction ?? undefined,
    issuing_body: row.issuing_body ?? undefined,
    source_channel: row.source_channel ?? undefined,
    doc_type: row.doc_type ?? undefined,
    provision_type: row.provision_type,
    answer_role: row.answer_role ?? undefined,
    source_page:
      row.source_page && /^\d+$/.test(row.source_page)
        ? Number(row.source_page)
        : undefined,
    source_section: row.source_section ?? undefined,
    retrieval_execution: execution.id,
  }));

  const limit = plan.executions.length > 1 ? 3 : FINAL_LIMIT;
  return rerankByAuthority(
    candidates,
    plan.jurisdiction,
    plan.rankingMode,
    plan.strictDateOrdering,
  ).slice(0, limit);
}
