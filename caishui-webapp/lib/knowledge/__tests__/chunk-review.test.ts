import { beforeEach, describe, expect, it, vi } from "vitest";

const { tx, transaction } = vi.hoisted(() => {
  const tx = {
    knowledgeChunk: {
      findUniqueOrThrow: vi.fn(async () => ({
        id: "chunk-1",
        verification_status: "unverified",
        verification_method: null,
        verification_notes: null,
        retrieval_status: "RETRIEVABLE",
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
  };
});

vi.mock("@/lib/db/client", () => ({
  prisma: {
    $transaction: transaction,
  },
}));

import { rejectChunk, verifyChunkHuman } from "@/lib/knowledge/chunk-review";

describe("verifyChunkHuman", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reviewer 可以人工核验未核验且可检索的 chunk，并写入审计事件", async () => {
    await verifyChunkHuman(
      "chunk-1",
      { id: "reviewer-1", roles: ["reviewer"] },
      "已核对国家税务总局官网原文链接 https://example.test/policy",
    );

    expect(tx.knowledgeChunk.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: "chunk-1" },
      select: {
        id: true,
        verification_status: true,
        verification_method: true,
        verification_notes: true,
        retrieval_status: true,
      },
    });
    expect(tx.knowledgeChunk.update).toHaveBeenCalledWith({
      where: { id: "chunk-1" },
      data: {
        verification_status: "verified",
        verification_method: "human",
        verified_by: "reviewer-1",
        verified_at: expect.any(Date),
        verification_notes:
          "已核对国家税务总局官网原文链接 https://example.test/policy",
      },
    });
    expect(tx.auditEvent.create).toHaveBeenCalledWith({
      data: {
        actor_id: "reviewer-1",
        action: "human_verified",
        target_type: "KnowledgeChunk",
        target_id: "chunk-1",
        old_state: {
          id: "chunk-1",
          verification_status: "unverified",
          verification_method: null,
          verification_notes: null,
          retrieval_status: "RETRIEVABLE",
        },
        new_state: {
          verification_status: "verified",
          verification_method: "human",
        },
        reason: "已核对国家税务总局官网原文链接 https://example.test/policy",
      },
    });
  });

  it("viewer 不能人工核验，且不会开启事务", async () => {
    await expect(
      verifyChunkHuman(
        "chunk-1",
        { id: "viewer-1", roles: ["viewer"] },
        "已核对官方原文",
      ),
    ).rejects.toThrow("forbidden_requires_role:reviewer");

    expect(transaction).not.toHaveBeenCalled();
  });

  it("人工核验备注不能为空，且不会开启事务", async () => {
    await expect(
      verifyChunkHuman(
        "chunk-1",
        { id: "reviewer-1", roles: ["reviewer"] },
        "   ",
      ),
    ).rejects.toThrow("verification_notes_required");

    expect(transaction).not.toHaveBeenCalled();
  });

  it("已撤出检索的 chunk 不能被人工核验", async () => {
    tx.knowledgeChunk.findUniqueOrThrow.mockResolvedValueOnce({
      id: "chunk-1",
      verification_status: "unverified",
      verification_method: null,
      verification_notes: null,
      retrieval_status: "WITHDRAWN",
    });

    await expect(
      verifyChunkHuman(
        "chunk-1",
        { id: "reviewer-1", roles: ["reviewer"] },
        "已核对官方原文",
      ),
    ).rejects.toThrow("chunk_not_retrievable");

    expect(tx.knowledgeChunk.update).not.toHaveBeenCalled();
    expect(tx.auditEvent.create).not.toHaveBeenCalled();
  });
});

describe("rejectChunk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reviewer 可以拒绝未核验且可检索的低质量 chunk，并写入审计事件", async () => {
    await rejectChunk(
      "chunk-1",
      { id: "reviewer-1", roles: ["reviewer"] },
      "分块边界错误，表格内容缺失",
    );

    expect(tx.knowledgeChunk.update).toHaveBeenCalledWith({
      where: { id: "chunk-1" },
      data: {
        verification_status: "rejected",
        verification_method: null,
        verified_by: null,
        verified_at: null,
        verification_notes: "分块边界错误，表格内容缺失",
      },
    });
    expect(tx.auditEvent.create).toHaveBeenCalledWith({
      data: {
        actor_id: "reviewer-1",
        action: "chunk_rejected",
        target_type: "KnowledgeChunk",
        target_id: "chunk-1",
        old_state: {
          id: "chunk-1",
          verification_status: "unverified",
          verification_method: null,
          verification_notes: null,
          retrieval_status: "RETRIEVABLE",
        },
        new_state: {
          verification_status: "rejected",
          verification_method: null,
        },
        reason: "分块边界错误，表格内容缺失",
      },
    });
  });

  it("非 reviewer 不能拒绝 chunk，且不会开启事务", async () => {
    await expect(
      rejectChunk(
        "chunk-1",
        { id: "viewer-1", roles: ["viewer"] },
        "分块质量不合格",
      ),
    ).rejects.toThrow("forbidden_requires_role:reviewer");

    expect(transaction).not.toHaveBeenCalled();
  });

  it("拒绝原因不能为空，且不会开启事务", async () => {
    await expect(
      rejectChunk(
        "chunk-1",
        { id: "reviewer-1", roles: ["reviewer"] },
        "   ",
      ),
    ).rejects.toThrow("rejection_reason_required");

    expect(transaction).not.toHaveBeenCalled();
  });
});
