import { beforeEach, describe, expect, it, vi } from "vitest";

const { tx, transaction } = vi.hoisted(() => {
  const tx = {
    sourceDocument: {
      findUniqueOrThrow: vi.fn(async () => ({
        id: "doc-1",
        retrieval_status: "RETRIEVABLE",
      })),
      update: vi.fn(async () => undefined),
    },
    knowledgeChunk: {
      findMany: vi.fn(async () => [{ id: "chunk-1" }, { id: "chunk-2" }]),
      updateMany: vi.fn(async () => undefined),
    },
    answerCitation: {
      findMany: vi.fn(async () => [
        { id: "citation-1", snapshot: { docNumber: "财税〔2024〕1号" } },
        { id: "citation-2", snapshot: { docNumber: "财税〔2024〕1号" } },
      ]),
    },
    citationAnnotation: {
      createMany: vi.fn(async () => undefined),
      updateMany: vi.fn(async () => undefined),
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

import {
  restoreSourceWithAudit,
  withdrawSourceWithAudit,
} from "@/lib/knowledge/source-withdrawal";

describe("withdrawSourceWithAudit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("撤出来源时为历史引用追加来源撤出注解且不改写引用快照", async () => {
    await withdrawSourceWithAudit(
      "doc-1",
      { id: "admin-1", roles: ["admin"] },
      "来源文件解析错误",
    );

    expect(tx.knowledgeChunk.findMany).toHaveBeenCalledWith({
      where: {
        document_id: "doc-1",
        retrieval_status: "RETRIEVABLE",
      },
      select: { id: true },
    });
    expect(tx.answerCitation.findMany).toHaveBeenCalledWith({
      where: {
        chunk_id: { in: ["chunk-1", "chunk-2"] },
        annotations: {
          none: { annotation_type: "source_withdrawn", resolved_at: null },
        },
      },
      select: { id: true },
    });
    expect(tx.citationAnnotation.createMany).toHaveBeenCalledWith({
      data: [
        {
          answer_citation_id: "citation-1",
          annotation_type: "source_withdrawn",
          message: "该引用来源已从当前知识库中撤出：来源文件解析错误",
        },
        {
          answer_citation_id: "citation-2",
          annotation_type: "source_withdrawn",
          message: "该引用来源已从当前知识库中撤出：来源文件解析错误",
        },
      ],
    });
  });

  it("没有历史引用时不创建来源撤出注解", async () => {
    tx.answerCitation.findMany.mockResolvedValueOnce([]);

    await withdrawSourceWithAudit(
      "doc-1",
      { id: "admin-1", roles: ["admin"] },
      "来源过期",
    );

    expect(tx.sourceDocument.update).toHaveBeenCalled();
    expect(tx.knowledgeChunk.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["chunk-1", "chunk-2"] },
        retrieval_status: "RETRIEVABLE",
      },
      data: {
        retrieval_status: "WITHDRAWN",
        withdrawn_at: expect.any(Date),
        withdrawn_by: "admin-1",
        withdrawal_reason: "来源过期",
      },
    });
    expect(tx.citationAnnotation.createMany).not.toHaveBeenCalled();
    expect(tx.auditEvent.create).toHaveBeenCalled();
  });

  it("非 admin 不能撤出来源且不会开启事务", async () => {
    await expect(
      withdrawSourceWithAudit(
        "doc-1",
        { id: "reviewer-1", roles: ["reviewer"] },
        "来源过期",
      ),
    ).rejects.toThrow("forbidden");

    expect(transaction).not.toHaveBeenCalled();
  });

  it("撤出原因不能为空且不会开启事务", async () => {
    await expect(
      withdrawSourceWithAudit(
        "doc-1",
        { id: "admin-1", roles: ["admin"] },
        "   ",
      ),
    ).rejects.toThrow("withdrawal_reason_required");

    expect(transaction).not.toHaveBeenCalled();
  });

  it("恢复来源时恢复 chunks 检索资格并解决未关闭的撤出注解", async () => {
    tx.sourceDocument.findUniqueOrThrow.mockResolvedValueOnce({
      id: "doc-1",
      retrieval_status: "WITHDRAWN",
    });

    await restoreSourceWithAudit(
      "doc-1",
      { id: "admin-1", roles: ["admin"] },
      "已重新核对来源",
    );

    expect(tx.sourceDocument.update).toHaveBeenCalledWith({
      where: { id: "doc-1" },
      data: { retrieval_status: "RETRIEVABLE" },
    });
    expect(tx.knowledgeChunk.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["chunk-1", "chunk-2"] },
        retrieval_status: "WITHDRAWN",
      },
      data: {
        retrieval_status: "RETRIEVABLE",
        withdrawn_at: null,
        withdrawn_by: null,
        withdrawal_reason: null,
      },
    });
    expect(tx.citationAnnotation.updateMany).toHaveBeenCalledWith({
      where: {
        annotation_type: "source_withdrawn",
        resolved_at: null,
        answer_citation: { chunk_id: { in: ["chunk-1", "chunk-2"] } },
      },
      data: { resolved_at: expect.any(Date) },
    });
    expect(tx.auditEvent.create).toHaveBeenCalledWith({
      data: {
        actor_id: "admin-1",
        action: "source_restored",
        target_type: "SourceDocument",
        target_id: "doc-1",
        old_state: { retrieval_status: "WITHDRAWN" },
        new_state: { retrieval_status: "RETRIEVABLE" },
        reason: "已重新核对来源",
      },
    });
  });
});
