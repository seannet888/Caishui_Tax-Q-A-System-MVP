import { beforeEach, describe, expect, it, vi } from "vitest";

const { verifyChunkHuman, rejectChunk } = vi.hoisted(() => ({
  verifyChunkHuman: vi.fn(async () => undefined),
  rejectChunk: vi.fn(async () => undefined),
}));

const { triggerChunkEmbedding } = vi.hoisted(() => ({
  triggerChunkEmbedding: vi.fn(
    async (): Promise<{
      ok: boolean;
      status: "QUEUED" | "FAILED";
      error?: string;
    }> => ({ ok: true, status: "QUEUED" }),
  ),
}));

vi.mock("@/lib/knowledge/chunk-review", () => ({
  verifyChunkHuman,
  rejectChunk,
}));

vi.mock("@/lib/pipeline/embedding-trigger", () => ({
  triggerChunkEmbedding,
}));

import { POST as verifyPOST } from "@/app/api/chunks/[chunkId]/verify/route";
import { POST as rejectPOST } from "@/app/api/chunks/[chunkId]/reject/route";
import { POST as embedPOST } from "@/app/api/chunks/[chunkId]/embed/route";

describe("POST /api/chunks/[chunkId]/verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    triggerChunkEmbedding.mockResolvedValue({ ok: true, status: "QUEUED" });
    process.env.MVP_ACTOR_ID = "reviewer-1";
    process.env.MVP_ACTOR_ROLES = "reviewer";
  });

  it("将 notes、chunkId 和当前 actor 传给 Human Verification 服务", async () => {
    const response = await verifyPOST(
      new Request("http://localhost/api/chunks/chunk-1/verify", {
        method: "POST",
        body: JSON.stringify({ notes: "已核对官方原文" }),
      }) as never,
      { params: { chunkId: "chunk-1" } },
    );

    await expect(response.json()).resolves.toEqual({
      ok: true,
      embedding: { ok: true, status: "QUEUED" },
    });
    expect(response.status).toBe(200);
    expect(verifyChunkHuman).toHaveBeenCalledWith(
      "chunk-1",
      { id: "reviewer-1", roles: ["reviewer"] },
      "已核对官方原文",
    );
    expect(triggerChunkEmbedding).toHaveBeenCalledWith("chunk-1", {
      id: "reviewer-1",
      roles: ["reviewer"],
    });
  });

  it("embedding trigger 失败时不回滚核验，并在响应中返回失败状态", async () => {
    triggerChunkEmbedding.mockResolvedValueOnce({
      ok: false,
      status: "FAILED",
      error: "pipeline_unavailable",
    });

    const response = await verifyPOST(
      new Request("http://localhost/api/chunks/chunk-1/verify", {
        method: "POST",
        body: JSON.stringify({ notes: "已核对官方原文" }),
      }) as never,
      { params: { chunkId: "chunk-1" } },
    );

    await expect(response.json()).resolves.toEqual({
      ok: true,
      embedding: {
        ok: false,
        status: "FAILED",
        error: "pipeline_unavailable",
      },
    });
    expect(verifyChunkHuman).toHaveBeenCalled();
  });

  it("权限不足时返回 403", async () => {
    verifyChunkHuman.mockRejectedValueOnce(
      new Error("forbidden_requires_role:reviewer"),
    );

    const response = await verifyPOST(
      new Request("http://localhost/api/chunks/chunk-1/verify", {
        method: "POST",
        body: JSON.stringify({ notes: "已核对官方原文" }),
      }) as never,
      { params: { chunkId: "chunk-1" } },
    );

    await expect(response.json()).resolves.toEqual({
      error: "forbidden_requires_role",
      detail: "reviewer",
    });
    expect(response.status).toBe(403);
  });
});

describe("POST /api/chunks/[chunkId]/reject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    triggerChunkEmbedding.mockResolvedValue({ ok: true, status: "QUEUED" });
    process.env.MVP_ACTOR_ID = "reviewer-1";
    process.env.MVP_ACTOR_ROLES = "reviewer";
  });

  it("将 reason、chunkId 和当前 actor 传给 Reject Chunk 服务", async () => {
    const response = await rejectPOST(
      new Request("http://localhost/api/chunks/chunk-1/reject", {
        method: "POST",
        body: JSON.stringify({ reason: "表格解析缺列" }),
      }) as never,
      { params: { chunkId: "chunk-1" } },
    );

    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(response.status).toBe(200);
    expect(rejectChunk).toHaveBeenCalledWith(
      "chunk-1",
      { id: "reviewer-1", roles: ["reviewer"] },
      "表格解析缺列",
    );
  });
});

describe("POST /api/chunks/[chunkId]/embed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    triggerChunkEmbedding.mockResolvedValue({ ok: true, status: "QUEUED" });
    process.env.MVP_ACTOR_ID = "reviewer-1";
    process.env.MVP_ACTOR_ROLES = "reviewer";
  });

  it("允许 reviewer 为已核验但未向量化完成的 chunk 重新触发 embedding", async () => {
    const response = await embedPOST(
      new Request("http://localhost/api/chunks/chunk-1/embed", {
        method: "POST",
      }) as never,
      { params: { chunkId: "chunk-1" } },
    );

    await expect(response.json()).resolves.toEqual({
      ok: true,
      embedding: { ok: true, status: "QUEUED" },
    });
    expect(response.status).toBe(200);
    expect(verifyChunkHuman).not.toHaveBeenCalled();
    expect(triggerChunkEmbedding).toHaveBeenCalledWith("chunk-1", {
      id: "reviewer-1",
      roles: ["reviewer"],
    });
  });

  it("viewer 不能重新触发 chunk embedding", async () => {
    process.env.MVP_ACTOR_ROLES = "viewer";

    const response = await embedPOST(
      new Request("http://localhost/api/chunks/chunk-1/embed", {
        method: "POST",
      }) as never,
      { params: { chunkId: "chunk-1" } },
    );

    await expect(response.json()).resolves.toEqual({
      error: "forbidden_requires_role",
      detail: "reviewer",
    });
    expect(response.status).toBe(403);
    expect(triggerChunkEmbedding).not.toHaveBeenCalled();
  });
});
