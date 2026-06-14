// Document Review Read Model：为 reviewer/admin 页面投影 SourceDocument + chunks。
// 只做只读投影，不执行核验/拒绝等状态转换。

import { prisma } from "@/lib/db/client";

export interface DocumentReviewModel {
  document: {
    id: string;
    title: string;
    docNumber: string | null;
    processingStatus: string;
    retrievalStatus: string;
    errorMessage: string | null;
    publishDate: Date | null;
    effectiveDate: Date | null;
    lifecycle: DocumentLifecycleSummary;
  };
  pagination: ChunkPagination;
  chunks: ChunkReviewItem[];
}

export interface ChunkPagination {
  chunkPage: number;
  chunkPageSize: number;
  chunkTotal: number;
  chunkPageCount: number;
}

export interface DocumentLifecycleSummary {
  retrievalState: "retrievable" | "withdrawn" | "not_ready" | "failed";
  summary: string;
  readyChunkCount: number;
  blockedChunkCount: number;
  unverifiedChunkCount: number;
  canWithdraw: boolean;
  canRestore: boolean;
}

export interface ChunkReviewItem {
  id: string;
  index: number;
  type: string;
  content: string;
  contentHash: string;
  verificationStatus: string;
  verificationMethod: string | null;
  verificationNotes: string | null;
  verifiedBy: string | null;
  verifiedAt: Date | null;
  embeddingStatus: string;
  retrievalStatus: string;
  effectiveDate: Date | null;
  expireDate: Date | null;
  articleNumber: string | null;
  canReview: boolean;
  retrievalReadiness: "ready" | "blocked" | "not_verified";
  readinessMessage: string | null;
  canRetryEmbedding: boolean;
}

const DOCUMENT_REVIEW_SELECT = {
  id: true,
  title: true,
  doc_number: true,
  processing_status: true,
  retrieval_status: true,
  error_message: true,
  publish_date: true,
  effective_date: true,
  _count: { select: { chunks: true } },
  chunks: {
    orderBy: { chunk_index: "asc" as const },
    skip: 0,
    take: 50,
    select: {
      id: true,
      chunk_index: true,
      chunk_type: true,
      content: true,
      content_hash: true,
      verification_status: true,
      verification_method: true,
      verification_notes: true,
      verified_by: true,
      verified_at: true,
      embedding_status: true,
      retrieval_status: true,
      effective_date: true,
      expire_date: true,
      metadata: true,
    },
  },
} as const;

export async function loadDocumentReview(
  documentId: string,
  options?: { chunkPage?: number; chunkPageSize?: number },
): Promise<DocumentReviewModel | null> {
  const paginationInput = normalizeChunkPagination(options);
  const doc = await prisma.sourceDocument.findUnique({
    where: { id: documentId },
    select: {
      ...DOCUMENT_REVIEW_SELECT,
      chunks: {
        ...DOCUMENT_REVIEW_SELECT.chunks,
        skip: (paginationInput.chunkPage - 1) * paginationInput.chunkPageSize,
        take: paginationInput.chunkPageSize,
      },
    },
  });
  if (!doc) return null;

  const chunks = [...doc.chunks]
    .sort((a, b) => a.chunk_index - b.chunk_index)
    .map((chunk) => {
      const readiness = readRetrievalReadiness(chunk);
      return {
        id: chunk.id,
        index: chunk.chunk_index,
        type: chunk.chunk_type,
        content: chunk.content,
        contentHash: chunk.content_hash,
        verificationStatus: chunk.verification_status,
        verificationMethod: chunk.verification_method,
        verificationNotes: chunk.verification_notes,
        verifiedBy: chunk.verified_by,
        verifiedAt: chunk.verified_at,
        embeddingStatus: chunk.embedding_status,
        retrievalStatus: chunk.retrieval_status,
        effectiveDate: chunk.effective_date,
        expireDate: chunk.expire_date,
        articleNumber: readArticleNumber(chunk.metadata),
        canReview:
          chunk.verification_status === "unverified" &&
          chunk.retrieval_status === "RETRIEVABLE",
        retrievalReadiness: readiness.status,
        readinessMessage: readiness.message,
        canRetryEmbedding: readiness.canRetryEmbedding,
      };
    });

  const chunkTotal = doc._count?.chunks ?? chunks.length;
  return {
    document: {
      id: doc.id,
      title: doc.title,
      docNumber: doc.doc_number,
      processingStatus: doc.processing_status,
      retrievalStatus: doc.retrieval_status,
      errorMessage: doc.error_message,
      publishDate: doc.publish_date,
      effectiveDate: doc.effective_date,
      lifecycle: summarizeDocumentLifecycle({
        processingStatus: doc.processing_status,
        retrievalStatus: doc.retrieval_status,
        chunks,
      }),
    },
    pagination: {
      ...paginationInput,
      chunkTotal,
      chunkPageCount: Math.max(1, Math.ceil(chunkTotal / paginationInput.chunkPageSize)),
    },
    chunks,
  };
}

function normalizeChunkPagination(options?: {
  chunkPage?: number;
  chunkPageSize?: number;
}): { chunkPage: number; chunkPageSize: number } {
  const chunkPage = Number.isFinite(options?.chunkPage)
    ? Math.max(1, Math.floor(options?.chunkPage ?? 1))
    : 1;
  const requestedSize = Number.isFinite(options?.chunkPageSize)
    ? Math.floor(options?.chunkPageSize ?? 50)
    : 50;
  const chunkPageSize = Math.min(100, Math.max(1, requestedSize));
  return { chunkPage, chunkPageSize };
}

function summarizeDocumentLifecycle(input: {
  processingStatus: string;
  retrievalStatus: string;
  chunks: ChunkReviewItem[];
}): DocumentLifecycleSummary {
  const readyChunkCount = input.chunks.filter(
    (chunk) => chunk.retrievalReadiness === "ready",
  ).length;
  const unverifiedChunkCount = input.chunks.filter(
    (chunk) => chunk.retrievalReadiness === "not_verified",
  ).length;
  const blockedChunkCount = input.chunks.length - readyChunkCount;

  if (input.processingStatus === "FAILED") {
    return {
      retrievalState: "failed",
      summary: "来源处理失败，当前不会产生可检索 chunk",
      readyChunkCount,
      blockedChunkCount,
      unverifiedChunkCount,
      canWithdraw: input.retrievalStatus === "RETRIEVABLE",
      canRestore: false,
    };
  }

  if (input.retrievalStatus === "WITHDRAWN") {
    return {
      retrievalState: "withdrawn",
      summary: "来源已撤出当前检索，新回答不会引用该来源",
      readyChunkCount,
      blockedChunkCount,
      unverifiedChunkCount,
      canWithdraw: false,
      canRestore: true,
    };
  }

  if (readyChunkCount === 0) {
    return {
      retrievalState: "not_ready",
      summary: `当前来源暂不可被默认检索召回：0 个 chunk 已就绪，${blockedChunkCount} 个尚未就绪`,
      readyChunkCount,
      blockedChunkCount,
      unverifiedChunkCount,
      canWithdraw: true,
      canRestore: false,
    };
  }

  return {
    retrievalState: "retrievable",
    summary: `当前来源可被默认检索召回：${readyChunkCount} 个 chunk 已就绪，${blockedChunkCount} 个尚未就绪`,
    readyChunkCount,
    blockedChunkCount,
    unverifiedChunkCount,
    canWithdraw: true,
    canRestore: false,
  };
}

function readRetrievalReadiness(chunk: {
  verification_status: string;
  embedding_status: string;
  retrieval_status: string;
}): {
  status: ChunkReviewItem["retrievalReadiness"];
  message: string | null;
  canRetryEmbedding: boolean;
} {
  if (chunk.verification_status !== "verified") {
    return {
      status: "not_verified",
      message: "尚未核验，默认检索不会召回该 chunk",
      canRetryEmbedding: false,
    };
  }
  if (chunk.retrieval_status !== "RETRIEVABLE") {
    return {
      status: "blocked",
      message: "该 chunk 已撤出检索，默认检索不会召回",
      canRetryEmbedding: false,
    };
  }
  if (
    chunk.embedding_status === "COMPLETED" &&
    chunk.retrieval_status === "RETRIEVABLE"
  ) {
    return { status: "ready", message: null, canRetryEmbedding: false };
  }
  return {
    status: "blocked",
    message: "已核验，但 embedding 尚未完成，默认检索不会召回该 chunk",
    canRetryEmbedding: true,
  };
}

function readArticleNumber(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const value = (metadata as { article_number?: unknown }).article_number;
  return typeof value === "string" && value.trim() ? value : null;
}
