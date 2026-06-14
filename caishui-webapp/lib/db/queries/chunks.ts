// lib/db/queries/chunks.ts
// KnowledgeChunk 查询函数。查询函数只做数据读写，不含业务逻辑（铁律二）。
//
// ⚠️ Prisma 对 Unsupported("vector") 字段无法直接赋值或读取，必须通过原始 SQL。
// ⚠️ pgvector `<=>` 返回余弦距离（越小越相似）；similarity = 1 - distance（越大越相似）。
//    排序用 distance ASC；应用层二次排序只用转换后的 similarity DESC。禁止把 distance 当 similarity。

import {
  EmbeddingStatus,
  Prisma,
  ProcessingStatus,
  RetrievalStatus,
} from "@prisma/client";
import { prisma } from "@/lib/db/client";

export interface VectorSearchRow {
  id: string;
  document_id: string;
  content: string;
  content_hash: string;
  chunk_type: string;
  distance: number;
  similarity: number;
  title: string;
  source_document_name: string;
  doc_number: string | null;
  publish_date: Date | null;
  authority_rank: number | null;
  effective_date: Date | null;
  expire_date: Date | null;
  jurisdiction: string | null;
  issuing_body: string | null;
  source_channel: string | null;
  doc_type: string | null;
  provision_type: string;
  answer_role: string | null;
  source_page: string | null;
  source_section: string | null;
}

/**
 * 写入向量。embedding 长度必须为 1024（BAAI/bge-large-zh-v1.5 @ 硅基流动，见 ADR-0006）。
 */
export async function updateChunkEmbedding(
  chunkId: string,
  embedding: number[],
): Promise<void> {
  if (embedding.length !== 1024) {
    throw new Error("embedding_dimension_must_be_1024");
  }
  const vectorLiteral = `[${embedding.join(",")}]`;
  await prisma.$executeRaw`
    UPDATE knowledge_chunks
    SET embedding = ${vectorLiteral}::vector
    WHERE id = ${chunkId}
  `;
}

/**
 * 向量检索：返回余弦距离与归一化相似度。
 * 默认应用 Effective Applicability 硬过滤（时效 + 当前版本 + 已核验 + 可检索）。
 * `extraFilter` 由 retriever 注入时间意图过滤（必须为参数化 Prisma.Sql）。
 *
 * ⚠️ 管辖地（jurisdiction）不在此层过滤（见 ADR-0004：管辖地是软性排序/分组维度）。
 * 全量按相似度召回后，由 rerankByAuthority/groupByJurisdiction 在应用层做本地优先 +
 * 全国兜底。禁止在此 WHERE 中加入 jurisdiction 条件。
 */
export async function searchByVector(
  queryEmbedding: number[],
  limit = 30,
  extraFilter?: Prisma.Sql,
): Promise<VectorSearchRow[]> {
  const vectorLiteral = `[${queryEmbedding.join(",")}]`;
  const completed = ProcessingStatus.COMPLETED;
  const retrievable = RetrievalStatus.RETRIEVABLE;
  const embeddingCompleted = EmbeddingStatus.COMPLETED;
  const applicabilityFilter =
    extraFilter ??
    Prisma.sql`
      AND (kc.effective_date IS NULL OR kc.effective_date <= NOW())
      AND (kc.expire_date IS NULL OR kc.expire_date > NOW())
    `;

  return prisma.$queryRaw<VectorSearchRow[]>`
    SELECT
      kc.id,
      kc.document_id,
      kc.content,
      kc.content_hash,
      kc.chunk_type,
      (kc.embedding <=> ${vectorLiteral}::vector) AS distance,
      1 - (kc.embedding <=> ${vectorLiteral}::vector) AS similarity,
      d.title,
      d.file_name AS source_document_name,
      d.doc_number,
      kc.publish_date,
      kc.authority_rank,
      kc.effective_date,
      kc.expire_date,
      kc.jurisdiction,
      d.issuing_body,
      COALESCE(kc.source_channel, d.source_channel) AS source_channel,
      LOWER(kc.doc_type::text) AS doc_type,
      kc.provision_type,
      kc.answer_role,
      kc.metadata ->> 'source_page' AS source_page,
      kc.metadata ->> 'source_section' AS source_section
    FROM knowledge_chunks kc
    JOIN source_documents d ON kc.document_id = d.id
    WHERE
      d.processing_status = ${completed}::"ProcessingStatus"
      AND d.retrieval_status = ${retrievable}::"RetrievalStatus"
      AND kc.retrieval_status = ${retrievable}::"RetrievalStatus"
      AND kc.verification_status = 'verified'
      AND kc.embedding_status = ${embeddingCompleted}::"EmbeddingStatus"
      AND kc.embedding IS NOT NULL
      AND kc.is_current_version = true
      ${applicabilityFilter}
    ORDER BY distance ASC
    LIMIT ${limit}
  `;
}
