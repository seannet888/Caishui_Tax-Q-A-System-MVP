import { beforeEach, describe, expect, it, vi } from "vitest";

const { signPipelineRequest } = vi.hoisted(() => ({
  signPipelineRequest: vi.fn(() => ({ "X-Signed": "yes" })),
}));

vi.mock("@/lib/pipeline/trust-adapter", () => ({
  signPipelineRequest,
}));

import { startPipelinePreview } from "@/lib/pipeline/preview-client";

describe("startPipelinePreview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATA_PIPELINE_URL = "http://pipeline.test";
  });

  it("向 data-pipeline /preview 发送 signed FormData 并返回 PipelineOutput", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      expect(init.method).toBe("POST");
      expect(init.headers).toEqual({ "X-Signed": "yes" });
      const body = init.body as FormData;
      expect(body.get("title")).toBe("政策预览");
      expect(body.get("source_channel")).toBe("国家税务总局官网");
      expect(body.get("doc_type")).toBe("notice");
      return Response.json({
        task_id: "preview",
        document_id: "preview",
        status: "success",
        chunks: [],
        total_chunks: 0,
        processing_time_ms: 5,
        errors: [],
        created_at: "2026-06-12T00:00:00.000Z",
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const output = await startPipelinePreview({
      actor: { id: "admin-1", roles: ["admin"] },
      fileName: "policy.md",
      bytes: Buffer.from("# 政策"),
      title: "政策预览",
      sourceChannel: "国家税务总局官网",
      docType: "notice",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://pipeline.test/preview",
      expect.any(Object),
    );
    expect(signPipelineRequest).toHaveBeenCalledWith({
      method: "POST",
      path: "/preview",
      actor: { id: "admin-1", roles: ["admin"] },
    });
    expect(output.status).toBe("success");
  });

  it("pipeline 返回非 JSON 错误时保留状态码和原文", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Internal Server Error", { status: 500 })),
    );

    await expect(
      startPipelinePreview({
        actor: { id: "admin-1", roles: ["admin"] },
        fileName: "policy.md",
        bytes: Buffer.from("# 政策"),
      }),
    ).rejects.toThrow("pipeline_preview_rejected:500:Internal Server Error");
  });

  it("pipeline 网络不可达时返回可诊断的 transport error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );

    await expect(
      startPipelinePreview({
        actor: { id: "admin-1", roles: ["admin"] },
        fileName: "policy.md",
        bytes: Buffer.from("# 政策"),
      }),
    ).rejects.toThrow("pipeline_preview_rejected:0:network_error:fetch failed");
  });
});
