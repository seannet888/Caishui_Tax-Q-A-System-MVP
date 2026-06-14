import { beforeEach, describe, expect, it, vi } from "vitest";

const { sourceDocument } = vi.hoisted(() => ({
  sourceDocument: {
    findUnique: vi.fn(),
  },
}));

vi.mock("@/lib/db/client", () => ({
  prisma: {
    sourceDocument,
  },
}));

import { loadDocumentReview } from "@/lib/knowledge/document-review-read-model";

describe("loadDocumentReview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("返回文档和按 chunk_index 排序的 chunk review read model", async () => {
    sourceDocument.findUnique.mockResolvedValueOnce({
      id: "doc-1",
      title: "研发费用加计扣除政策",
      doc_number: "财税〔2024〕1号",
      processing_status: "COMPLETED",
      retrieval_status: "RETRIEVABLE",
      error_message: null,
      publish_date: new Date("2024-01-10T00:00:00.000Z"),
      effective_date: new Date("2024-02-01T00:00:00.000Z"),
      chunks: [
        {
          id: "chunk-2",
          chunk_index: 2,
          chunk_type: "text",
          content: "第二条内容",
          content_hash: "hash-2",
          verification_status: "verified",
          verification_method: "human",
          verification_notes: "已核对",
          verified_by: "reviewer-1",
          verified_at: new Date("2024-02-02T00:00:00.000Z"),
          embedding_status: "COMPLETED",
          retrieval_status: "RETRIEVABLE",
          effective_date: new Date("2024-02-01T00:00:00.000Z"),
          expire_date: null,
          metadata: { article_number: "第二条" },
        },
        {
          id: "chunk-1",
          chunk_index: 1,
          chunk_type: "table",
          content: "第一条内容",
          content_hash: "hash-1",
          verification_status: "unverified",
          verification_method: null,
          verification_notes: null,
          verified_by: null,
          verified_at: null,
          embedding_status: "PENDING",
          retrieval_status: "RETRIEVABLE",
          effective_date: null,
          expire_date: null,
          metadata: {},
        },
      ],
    });

    const review = await loadDocumentReview("doc-1");

    expect(sourceDocument.findUnique).toHaveBeenCalledWith({
      where: { id: "doc-1" },
      select: expect.objectContaining({
        chunks: expect.objectContaining({
          skip: 0,
          take: 50,
        }),
        _count: { select: { chunks: true } },
      }),
    });
    expect(review).toMatchObject({
      document: {
        id: "doc-1",
        title: "研发费用加计扣除政策",
        docNumber: "财税〔2024〕1号",
        processingStatus: "COMPLETED",
        retrievalStatus: "RETRIEVABLE",
        errorMessage: null,
        lifecycle: {
          retrievalState: "retrievable",
          summary: "当前来源可被默认检索召回：1 个 chunk 已就绪，1 个尚未就绪",
          readyChunkCount: 1,
          blockedChunkCount: 1,
          unverifiedChunkCount: 1,
          canWithdraw: true,
          canRestore: false,
        },
      },
      pagination: {
        chunkPage: 1,
        chunkPageSize: 50,
        chunkTotal: 2,
        chunkPageCount: 1,
      },
      chunks: [
        {
          id: "chunk-1",
          index: 1,
          type: "table",
          content: "第一条内容",
          contentHash: "hash-1",
          verificationStatus: "unverified",
          verificationMethod: null,
          embeddingStatus: "PENDING",
          retrievalStatus: "RETRIEVABLE",
          canReview: true,
        },
        {
          id: "chunk-2",
          index: 2,
          type: "text",
          content: "第二条内容",
          contentHash: "hash-2",
          verificationStatus: "verified",
          verificationMethod: "human",
          verificationNotes: "已核对",
          verifiedBy: "reviewer-1",
          embeddingStatus: "COMPLETED",
          retrievalStatus: "RETRIEVABLE",
          articleNumber: "第二条",
          canReview: false,
          retrievalReadiness: "ready",
          readinessMessage: null,
        },
      ],
    });
  });

  it("支持按页加载 chunk，避免文档详情一次性读取所有内容", async () => {
    sourceDocument.findUnique.mockResolvedValueOnce({
      id: "doc-1",
      title: "研发费用加计扣除政策",
      doc_number: "财税〔2024〕1号",
      processing_status: "COMPLETED",
      retrieval_status: "RETRIEVABLE",
      error_message: null,
      publish_date: null,
      effective_date: null,
      _count: { chunks: 125 },
      chunks: [
        {
          id: "chunk-51",
          chunk_index: 51,
          chunk_type: "text",
          content: "第五十一段内容",
          content_hash: "hash-51",
          verification_status: "verified",
          verification_method: "human",
          verification_notes: null,
          verified_by: "reviewer-1",
          verified_at: new Date("2024-02-02T00:00:00.000Z"),
          embedding_status: "COMPLETED",
          retrieval_status: "RETRIEVABLE",
          effective_date: null,
          expire_date: null,
          metadata: {},
        },
      ],
    });

    const review = await loadDocumentReview("doc-1", {
      chunkPage: 3,
      chunkPageSize: 25,
    });

    expect(sourceDocument.findUnique).toHaveBeenCalledWith({
      where: { id: "doc-1" },
      select: expect.objectContaining({
        chunks: expect.objectContaining({
          skip: 50,
          take: 25,
        }),
        _count: { select: { chunks: true } },
      }),
    });
    expect(review).toMatchObject({
      pagination: {
        chunkPage: 3,
        chunkPageSize: 25,
        chunkTotal: 125,
        chunkPageCount: 5,
      },
      chunks: [{ id: "chunk-51", index: 51 }],
    });
  });

  it("标记已核验但 embedding 未完成的 chunk 为不可检索就绪", async () => {
    sourceDocument.findUnique.mockResolvedValueOnce({
      id: "doc-1",
      title: "研发费用加计扣除政策",
      doc_number: "财税〔2024〕1号",
      processing_status: "COMPLETED",
      retrieval_status: "RETRIEVABLE",
      error_message: null,
      publish_date: null,
      effective_date: null,
      chunks: [
        {
          id: "chunk-1",
          chunk_index: 1,
          chunk_type: "text",
          content: "第一条内容",
          content_hash: "hash-1",
          verification_status: "verified",
          verification_method: "human",
          verification_notes: "已核对",
          verified_by: "reviewer-1",
          verified_at: new Date("2024-02-02T00:00:00.000Z"),
          embedding_status: "FAILED",
          retrieval_status: "RETRIEVABLE",
          effective_date: null,
          expire_date: null,
          metadata: {},
        },
      ],
    });

    await expect(loadDocumentReview("doc-1")).resolves.toMatchObject({
      chunks: [
        {
          id: "chunk-1",
          verificationStatus: "verified",
          embeddingStatus: "FAILED",
          retrievalReadiness: "blocked",
          readinessMessage: "已核验，但 embedding 尚未完成，默认检索不会召回该 chunk",
          canRetryEmbedding: true,
        },
      ],
    });
  });

  it("撤出检索的 verified chunk 不显示 embedding retry 动作", async () => {
    sourceDocument.findUnique.mockResolvedValueOnce({
      id: "doc-1",
      title: "研发费用加计扣除政策",
      doc_number: "财税〔2024〕1号",
      processing_status: "COMPLETED",
      retrieval_status: "WITHDRAWN",
      error_message: null,
      publish_date: null,
      effective_date: null,
      chunks: [
        {
          id: "chunk-1",
          chunk_index: 1,
          chunk_type: "text",
          content: "第一条内容",
          content_hash: "hash-1",
          verification_status: "verified",
          verification_method: "human",
          verification_notes: "已核对",
          verified_by: "reviewer-1",
          verified_at: new Date("2024-02-02T00:00:00.000Z"),
          embedding_status: "COMPLETED",
          retrieval_status: "WITHDRAWN",
          effective_date: null,
          expire_date: null,
          metadata: {},
        },
      ],
    });

    await expect(loadDocumentReview("doc-1")).resolves.toMatchObject({
      document: {
        lifecycle: {
          retrievalState: "withdrawn",
          summary: "来源已撤出当前检索，新回答不会引用该来源",
          readyChunkCount: 0,
          blockedChunkCount: 1,
          unverifiedChunkCount: 0,
          canWithdraw: false,
          canRestore: true,
        },
      },
      chunks: [
        {
          id: "chunk-1",
          verificationStatus: "verified",
          embeddingStatus: "COMPLETED",
          retrievalStatus: "WITHDRAWN",
          retrievalReadiness: "blocked",
          readinessMessage: "该 chunk 已撤出检索，默认检索不会召回",
          canRetryEmbedding: false,
        },
      ],
    });
  });

  it("文档不存在时返回 null", async () => {
    sourceDocument.findUnique.mockResolvedValueOnce(null);

    await expect(loadDocumentReview("missing-doc")).resolves.toBeNull();
  });

  it("投影处理失败原因，供文档详情页展示", async () => {
    sourceDocument.findUnique.mockResolvedValueOnce({
      id: "doc-failed",
      title: "失败上传文件",
      doc_number: null,
      processing_status: "FAILED",
      retrieval_status: "RETRIEVABLE",
      error_message: "pipeline_rejected:500:Internal Server Error",
      publish_date: null,
      effective_date: null,
      chunks: [],
    });

    await expect(loadDocumentReview("doc-failed")).resolves.toMatchObject({
      document: {
        id: "doc-failed",
        processingStatus: "FAILED",
        errorMessage: "pipeline_rejected:500:Internal Server Error",
        lifecycle: {
          retrievalState: "failed",
          summary: "来源处理失败，当前不会产生可检索 chunk",
          readyChunkCount: 0,
          blockedChunkCount: 0,
          unverifiedChunkCount: 0,
          canWithdraw: true,
          canRestore: false,
        },
      },
      chunks: [],
    });
  });
});
