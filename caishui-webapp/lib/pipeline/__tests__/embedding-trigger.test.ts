import { beforeEach, describe, expect, it, vi } from "vitest";

import { triggerChunkEmbedding } from "@/lib/pipeline/embedding-trigger";

describe("triggerChunkEmbedding", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.PIPELINE_SHARED_SECRET = "test-secret";
    process.env.DATA_PIPELINE_URL = "http://pipeline.test";
  });

  it("向 data-pipeline 发起 signed single chunk embedding job", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ chunk_id: "chunk-1", status: "QUEUED" }), {
        status: 202,
        headers: { "content-type": "application/json" },
      }),
    );

    const result = await triggerChunkEmbedding("chunk-1", {
      id: "reviewer-1",
      roles: ["reviewer"],
    });

    expect(result).toEqual({ ok: true, status: "QUEUED" });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://pipeline.test/chunks/chunk-1/embed",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-Pipeline-Actor-ID": "reviewer-1",
          "X-Pipeline-Actor-Roles": "reviewer",
          "X-Pipeline-Auth-Version": "v1",
          "X-Pipeline-Signature": expect.any(String),
        }),
      }),
    );
  });

  it("pipeline 返回非 JSON 错误时保留状态码和原文", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Internal Server Error", { status: 500 }),
    );

    const result = await triggerChunkEmbedding("chunk-1", {
      id: "reviewer-1",
      roles: ["reviewer"],
    });

    expect(result).toEqual({
      ok: false,
      status: "FAILED",
      error: "pipeline_embedding_rejected:500:Internal Server Error",
    });
  });

  it("pipeline 网络不可达时返回可诊断的 transport error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new TypeError("fetch failed"),
    );

    const result = await triggerChunkEmbedding("chunk-1", {
      id: "reviewer-1",
      roles: ["reviewer"],
    });

    expect(result).toEqual({
      ok: false,
      status: "FAILED",
      error: "pipeline_embedding_rejected:0:network_error:fetch failed",
    });
  });
});
