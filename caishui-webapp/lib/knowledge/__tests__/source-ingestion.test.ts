import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, tx, transaction } = vi.hoisted(() => {
  const tx = {
    sourceDocument: {
      create: vi.fn(async ({ data }) => ({
        id: "doc-1",
        title: data.title,
        file_name: data.file_name,
        file_type: data.file_type,
        file_size: data.file_size,
        file_hash: data.file_hash,
        doc_type: data.doc_type,
        effective_date: data.effective_date,
        jurisdiction: data.jurisdiction,
        issuing_body: data.issuing_body,
        source_channel: data.source_channel,
      })),
      update: vi.fn(async () => undefined),
    },
    auditEvent: {
      create: vi.fn(async () => undefined),
    },
  };
  return {
    tx,
    transaction: vi.fn(async (callback: (txArg: typeof tx) => unknown) =>
      callback(tx),
    ),
    prisma: {
      sourceDocument: {
        findFirst: vi.fn(async (): Promise<{ id: string } | null> => null),
      },
      $transaction: undefined as unknown,
    },
  };
});

prisma.$transaction = transaction;

vi.mock("@/lib/db/client", () => ({
  prisma,
}));

import {
  markSourceIngestionFailed,
  prepareSourceDocumentIngestion,
} from "@/lib/knowledge/source-ingestion";

describe("prepareSourceDocumentIngestion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.sourceDocument.findFirst.mockResolvedValue(null);
  });

  it("admin 上传 Source Document 时创建 PENDING 记录、写审计，并返回 pipeline payload", async () => {
    const bytes = Buffer.from("official tax policy");
    const result = await prepareSourceDocumentIngestion({
      actor: { id: "admin-1", roles: ["admin"] },
      file: {
        name: "policy.pdf",
        size: bytes.length,
        bytes,
      },
      title: "研发费用加计扣除公告",
      sourceChannel: "国家税务总局官网",
      docType: "announcement",
      effectiveDate: "2024-01-01",
      jurisdiction: "全国",
      issuingBody: "国家税务总局",
      seedVerified: true,
      seedBatchId: "mvp-seed",
    });

    const expectedHash = createHash("sha256").update(bytes).digest("hex");

    expect(prisma.sourceDocument.findFirst).toHaveBeenCalledWith({
      where: {
        file_hash: expectedHash,
        source_channel: "国家税务总局官网",
      },
      select: { id: true },
    });
    expect(tx.sourceDocument.create).toHaveBeenCalledWith({
      data: {
        title: "研发费用加计扣除公告",
        file_name: "policy.pdf",
        file_type: "PDF",
        file_size: bytes.length,
        file_hash: expectedHash,
        processing_status: "PENDING",
        doc_type: "ANNOUNCEMENT",
        effective_date: new Date("2024-01-01T00:00:00.000Z"),
        jurisdiction: "全国",
        issuing_body: "国家税务总局",
        source_channel: "国家税务总局官网",
      },
    });
    expect(tx.auditEvent.create).toHaveBeenCalledWith({
      data: {
        actor_id: "admin-1",
        action: "upload",
        target_type: "SourceDocument",
        target_id: "doc-1",
        new_state: {
          processing_status: "PENDING",
          source_channel: "国家税务总局官网",
          file_hash: expectedHash,
        },
      },
    });
    expect(result.pipelinePayload).toEqual({
      fileName: "policy.pdf",
      bytes,
      documentId: "doc-1",
      fileHash: expectedHash,
      title: "研发费用加计扣除公告",
      sourceChannel: "国家税务总局官网",
      issuingBody: "国家税务总局",
      jurisdiction: "全国",
      docType: "announcement",
      effectiveDate: "2024-01-01",
      verificationMethod: "seed",
      seedBatchId: "mvp-seed",
    });
  });

  it("同一 file_hash + source_channel 已存在时拒绝创建新 Source Document", async () => {
    prisma.sourceDocument.findFirst.mockResolvedValueOnce({ id: "doc-existing" });

    await expect(
      prepareSourceDocumentIngestion({
        actor: { id: "admin-1", roles: ["admin"] },
        file: {
          name: "policy.pdf",
          size: 3,
          bytes: Buffer.from("dup"),
        },
        sourceChannel: "国家税务总局官网",
      }),
    ).rejects.toThrow("source_document_already_exists:doc-existing");

    expect(transaction).not.toHaveBeenCalled();
  });

  it("归一化 docType：DB 使用 Prisma enum，pipeline payload 使用小写 wire value", async () => {
    const result = await prepareSourceDocumentIngestion({
      actor: { id: "admin-1", roles: ["admin"] },
      file: {
        name: "policy.md",
        size: 3,
        bytes: Buffer.from("doc"),
      },
      sourceChannel: "国家税务总局官网",
      docType: "NOTICE",
    });

    expect(tx.sourceDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          doc_type: "NOTICE",
        }),
      }),
    );
    expect(result.pipelinePayload.docType).toBe("notice");
  });

  it("未知 docType 默认归一化为 notice", async () => {
    const result = await prepareSourceDocumentIngestion({
      actor: { id: "admin-1", roles: ["admin"] },
      file: {
        name: "policy.md",
        size: 3,
        bytes: Buffer.from("doc"),
      },
      sourceChannel: "国家税务总局官网",
      docType: "unknown",
    });

    expect(tx.sourceDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          doc_type: "NOTICE",
        }),
      }),
    );
    expect(result.pipelinePayload.docType).toBe("notice");
  });

  it("pipeline 启动失败后将 Source Document 标记为 FAILED 并写审计", async () => {
    await markSourceIngestionFailed(
      "doc-1",
      { id: "admin-1", roles: ["admin"] },
      "pipeline_unavailable",
    );

    expect(tx.sourceDocument.update).toHaveBeenCalledWith({
      where: { id: "doc-1" },
      data: {
        processing_status: "FAILED",
        error_message: "pipeline_unavailable",
      },
    });
    expect(tx.auditEvent.create).toHaveBeenCalledWith({
      data: {
        actor_id: "admin-1",
        action: "ingest_failed",
        target_type: "SourceDocument",
        target_id: "doc-1",
        reason: "pipeline_unavailable",
      },
    });
  });
});
