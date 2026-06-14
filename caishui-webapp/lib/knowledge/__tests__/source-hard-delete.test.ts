import { beforeEach, describe, expect, it, vi } from "vitest";

const { tx, transaction } = vi.hoisted(() => {
  const tx = {
    sourceDocument: {
      findUniqueOrThrow: vi.fn(async () => ({
        id: "doc-1",
        retrieval_status: "WITHDRAWN",
        file_hash: "hash-1",
        source_channel: "国家税务总局官网",
      })),
      delete: vi.fn(async () => undefined),
    },
    knowledgeChunk: {
      findMany: vi.fn(async () => [{ id: "chunk-1" }]),
      deleteMany: vi.fn(async () => ({ count: 1 })),
    },
    answerCitation: {
      count: vi.fn(async () => 0),
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
  };
});

vi.mock("@/lib/db/client", () => ({
  prisma: {
    $transaction: transaction,
  },
}));

import { hardDeleteSourceWithAudit } from "@/lib/knowledge/source-hard-delete";

describe("hardDeleteSourceWithAudit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.sourceDocument.findUniqueOrThrow.mockResolvedValue({
      id: "doc-1",
      retrieval_status: "WITHDRAWN",
      file_hash: "hash-1",
      source_channel: "国家税务总局官网",
    });
    tx.knowledgeChunk.findMany.mockResolvedValue([{ id: "chunk-1" }]);
    tx.answerCitation.count.mockResolvedValue(0);
  });

  it("存在历史 AnswerCitation 引用时拒绝硬删除，且不删除任何数据", async () => {
    tx.answerCitation.count.mockResolvedValueOnce(1);

    await expect(
      hardDeleteSourceWithAudit("doc-1", { id: "admin-1", roles: ["admin"] }, {
        confirm: true,
        reason: "误上传测试文件",
      }),
    ).rejects.toThrow("source_has_historical_citations");

    expect(tx.knowledgeChunk.findMany).toHaveBeenCalledWith({
      where: { document_id: "doc-1" },
      select: { id: true },
    });
    expect(tx.answerCitation.count).toHaveBeenCalledWith({
      where: { chunk_id: { in: ["chunk-1"] } },
    });
    expect(tx.knowledgeChunk.deleteMany).not.toHaveBeenCalled();
    expect(tx.sourceDocument.delete).not.toHaveBeenCalled();
    expect(tx.auditEvent.create).not.toHaveBeenCalled();
  });

  it("非 admin 角色不能硬删除来源，且不启动事务", async () => {
    await expect(
      hardDeleteSourceWithAudit(
        "doc-1",
        { id: "viewer-1", roles: ["viewer"] },
        {
          confirm: true,
          reason: "误上传测试文件",
        },
      ),
    ).rejects.toThrow("forbidden_requires_role:admin");

    expect(transaction).not.toHaveBeenCalled();
  });

  it("缺少二次确认时拒绝硬删除，且不启动事务", async () => {
    await expect(
      hardDeleteSourceWithAudit("doc-1", { id: "admin-1", roles: ["admin"] }, {
        confirm: false,
        reason: "误上传测试文件",
      }),
    ).rejects.toThrow("hard_delete_confirmation_required");

    expect(transaction).not.toHaveBeenCalled();
  });

  it("缺少删除原因时拒绝硬删除，且不启动事务", async () => {
    await expect(
      hardDeleteSourceWithAudit("doc-1", { id: "admin-1", roles: ["admin"] }, {
        confirm: true,
        reason: "   ",
      }),
    ).rejects.toThrow("hard_delete_reason_required");

    expect(transaction).not.toHaveBeenCalled();
  });

  it("无历史引用时删除来源及其 chunks，并写入硬删除审计", async () => {
    await hardDeleteSourceWithAudit(
      "doc-1",
      { id: "admin-1", roles: ["admin"] },
      {
        confirm: true,
        reason: "  误上传测试文件  ",
      },
    );

    expect(tx.sourceDocument.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: "doc-1" },
    });
    expect(tx.knowledgeChunk.deleteMany).toHaveBeenCalledWith({
      where: { document_id: "doc-1" },
    });
    expect(tx.sourceDocument.delete).toHaveBeenCalledWith({
      where: { id: "doc-1" },
    });
    expect(tx.auditEvent.create).toHaveBeenCalledWith({
      data: {
        actor_id: "admin-1",
        action: "hard_deleted",
        target_type: "SourceDocument",
        target_id: "doc-1",
        old_state: {
          id: "doc-1",
          retrieval_status: "WITHDRAWN",
          file_hash: "hash-1",
          source_channel: "国家税务总局官网",
          chunk_count: 1,
        },
        new_state: { deleted: true },
        reason: "误上传测试文件",
      },
    });

    const auditOrder = tx.auditEvent.create.mock.invocationCallOrder[0]!;
    const chunkDeleteOrder = tx.knowledgeChunk.deleteMany.mock
      .invocationCallOrder[0]!;
    const sourceDeleteOrder = tx.sourceDocument.delete.mock
      .invocationCallOrder[0]!;
    expect(auditOrder).toBeLessThan(chunkDeleteOrder);
    expect(auditOrder).toBeLessThan(sourceDeleteOrder);
  });
});
