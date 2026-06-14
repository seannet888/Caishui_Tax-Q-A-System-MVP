import { beforeEach, describe, expect, it, vi } from "vitest";

const { signPipelineRequest } = vi.hoisted(() => ({
  signPipelineRequest: vi.fn(() => ({ "X-Signed": "yes" })),
}));

vi.mock("@/lib/pipeline/trust-adapter", () => ({
  signPipelineRequest,
}));

import { startPipelineIngest } from "@/lib/pipeline/ingest-client";

describe("startPipelineIngest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATA_PIPELINE_URL = "http://pipeline.test";
  });

  it("向 data-pipeline /ingest 发送 signed FormData 并校验 accepted 响应", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      expect(init.method).toBe("POST");
      expect(init.headers).toEqual({ "X-Signed": "yes" });
      expect(init.body).toBeInstanceOf(FormData);
      const body = init.body as FormData;
      expect(body.get("document_id")).toBe("doc-1");
      expect(body.get("file_hash")).toBe("hash-1");
      expect(body.get("title")).toBe("政策公告");
      expect(body.get("source_channel")).toBe("国家税务总局官网");
      expect(body.get("doc_type")).toBe("announcement");
      expect(body.get("effective_date")).toBe("2024-01-01");
      expect(body.get("verification_method")).toBe("seed");
      expect(body.get("seed_batch_id")).toBe("mvp-seed");
      return Response.json(
        {
          task_id: "11111111-1111-4111-8111-111111111111",
          document_id: "doc-1",
          status: "PENDING",
        },
        { status: 202 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await startPipelineIngest({
      actor: { id: "admin-1", roles: ["admin"] },
      payload: {
        fileName: "policy.pdf",
        bytes: Buffer.from("pdf"),
        documentId: "doc-1",
        fileHash: "hash-1",
        title: "政策公告",
        sourceChannel: "国家税务总局官网",
        docType: "announcement",
        effectiveDate: "2024-01-01",
        verificationMethod: "seed",
        seedBatchId: "mvp-seed",
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://pipeline.test/ingest",
      expect.any(Object),
    );
    expect(signPipelineRequest).toHaveBeenCalledWith({
      method: "POST",
      path: "/ingest",
      actor: { id: "admin-1", roles: ["admin"] },
    });
    expect(result).toEqual({
      task_id: "11111111-1111-4111-8111-111111111111",
      document_id: "doc-1",
      status: "PENDING",
    });
  });

  it("pipeline 返回非 JSON 错误时保留状态码和原文", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Internal Server Error", { status: 500 })),
    );

    await expect(
      startPipelineIngest({
        actor: { id: "admin-1", roles: ["admin"] },
        payload: {
          fileName: "policy.pdf",
          bytes: Buffer.from("pdf"),
          documentId: "doc-1",
          fileHash: "hash-1",
          title: "政策公告",
          sourceChannel: "国家税务总局官网",
          docType: "announcement",
        },
      }),
    ).rejects.toThrow("pipeline_rejected:500:Internal Server Error");
  });

  it("pipeline 网络不可达时返回可诊断的 transport error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );

    await expect(
      startPipelineIngest({
        actor: { id: "admin-1", roles: ["admin"] },
        payload: {
          fileName: "policy.pdf",
          bytes: Buffer.from("pdf"),
          documentId: "doc-1",
          fileHash: "hash-1",
          title: "政策公告",
          sourceChannel: "国家税务总局官网",
          docType: "announcement",
        },
      }),
    ).rejects.toThrow("pipeline_rejected:0:network_error:fetch failed");
  });
});
