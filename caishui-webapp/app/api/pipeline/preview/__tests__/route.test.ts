import { beforeEach, describe, expect, it, vi } from "vitest";

const { startPipelinePreview, savePreviewSnapshot, loadPreviewSnapshot } = vi.hoisted(() => ({
  startPipelinePreview: vi.fn(async () => ({
    task_id: "preview",
    document_id: "preview",
    status: "success",
    chunks: [],
    total_chunks: 0,
    processing_time_ms: 1,
    errors: [],
    created_at: "2026-06-12T00:00:00.000Z",
  })),
  savePreviewSnapshot: vi.fn(() => ({ previewId: "preview_1" })),
  loadPreviewSnapshot: vi.fn(() => ({
    previewId: "preview_1",
    actorId: "admin-1",
    fileName: "policy.md",
    sourceChannel: "国家税务总局官网",
    createdAt: "2026-06-12T00:00:00.000Z",
    output: {
      task_id: "preview",
      document_id: "preview",
      status: "success",
      chunks: [],
      total_chunks: 0,
      processing_time_ms: 1,
      errors: [],
      created_at: "2026-06-12T00:00:00.000Z",
    },
  })),
}));

vi.mock("@/lib/pipeline/preview-client", () => ({
  startPipelinePreview,
}));

vi.mock("@/lib/knowledge/preview-persistence", () => ({
  loadPreviewSnapshot,
  savePreviewSnapshot,
}));

import { GET, POST } from "@/app/api/pipeline/preview/route";

describe("POST /api/pipeline/preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MVP_ACTOR_ID = "admin-1";
    process.env.MVP_ACTOR_ROLES = "admin";
  });

  it("rejects unsupported file extensions before calling pipeline preview", async () => {
    const form = new FormData();
    form.append("file", new File([Buffer.from("bad")], "payload.exe"));

    const response = await POST(
      new Request("http://localhost/api/pipeline/preview", {
        method: "POST",
        body: form,
      }) as never,
    );

    await expect(response.json()).resolves.toEqual({
      error: "unsupported_file_type",
    });
    expect(response.status).toBe(400);
    expect(startPipelinePreview).not.toHaveBeenCalled();
    expect(savePreviewSnapshot).not.toHaveBeenCalled();
  });

  it("rejects path traversal file names before calling pipeline preview", async () => {
    const form = new FormData();
    form.append("file", new File([Buffer.from("# policy")], "../policy.md"));

    const response = await POST(
      new Request("http://localhost/api/pipeline/preview", {
        method: "POST",
        body: form,
      }) as never,
    );

    await expect(response.json()).resolves.toEqual({
      error: "invalid_file_name",
    });
    expect(response.status).toBe(400);
    expect(startPipelinePreview).not.toHaveBeenCalled();
    expect(savePreviewSnapshot).not.toHaveBeenCalled();
  });

  it("调用 pipeline preview 后保存 preview snapshot 并返回 previewId", async () => {
    const form = new FormData();
    form.append("file", new File([Buffer.from("# 政策")], "policy.md"));
    form.append("title", "政策预览");
    form.append("sourceChannel", "国家税务总局官网");
    form.append("docType", "notice");

    const response = await POST(
      new Request("http://localhost/api/pipeline/preview", {
        method: "POST",
        body: form,
      }) as never,
    );

    await expect(response.json()).resolves.toEqual({
      previewId: "preview_1",
      output: {
        task_id: "preview",
        document_id: "preview",
        status: "success",
        chunks: [],
        total_chunks: 0,
        processing_time_ms: 1,
        errors: [],
        created_at: "2026-06-12T00:00:00.000Z",
      },
    });
    expect(response.status).toBe(200);
    expect(startPipelinePreview).toHaveBeenCalledWith({
      actor: { id: "admin-1", roles: ["admin"] },
      fileName: "policy.md",
      bytes: expect.any(Buffer),
      title: "政策预览",
      sourceChannel: "国家税务总局官网",
      issuingBody: undefined,
      jurisdiction: undefined,
      docType: "notice",
    });
    expect(savePreviewSnapshot).toHaveBeenCalledWith({
      actor: { id: "admin-1", roles: ["admin"] },
      fileName: "policy.md",
      sourceChannel: "国家税务总局官网",
      output: expect.objectContaining({ status: "success" }),
    });
  });

  it("按 previewId 读取已保存的 preview snapshot", async () => {
    const response = await GET(
      new Request("http://localhost/api/pipeline/preview?previewId=preview_1") as never,
    );

    await expect(response.json()).resolves.toEqual({
      previewId: "preview_1",
      actorId: "admin-1",
      fileName: "policy.md",
      sourceChannel: "国家税务总局官网",
      createdAt: "2026-06-12T00:00:00.000Z",
      output: {
        task_id: "preview",
        document_id: "preview",
        status: "success",
        chunks: [],
        total_chunks: 0,
        processing_time_ms: 1,
        errors: [],
        created_at: "2026-06-12T00:00:00.000Z",
      },
    });
    expect(response.status).toBe(200);
    expect(loadPreviewSnapshot).toHaveBeenCalledWith("preview_1");
  });
});
