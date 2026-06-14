import { describe, expect, it, vi } from "vitest";

const { prepareSourceDocumentIngestion, markSourceIngestionFailed } = vi.hoisted(
  () => ({
    prepareSourceDocumentIngestion: vi.fn(),
    markSourceIngestionFailed: vi.fn(),
  }),
);
const { startPipelineIngest } = vi.hoisted(() => ({
  startPipelineIngest: vi.fn(),
}));

vi.mock("@/lib/auth/actor", () => ({
  resolveActor: () => ({ id: "admin-1", roles: ["admin"] }),
}));

vi.mock("@/lib/knowledge/source-ingestion", () => ({
  prepareSourceDocumentIngestion,
  markSourceIngestionFailed,
}));

vi.mock("@/lib/pipeline/ingest-client", () => ({
  startPipelineIngest,
}));

import { POST } from "@/app/api/upload/route";

describe("POST /api/upload", () => {
  it("rejects unsupported file extensions before preparing ingestion", async () => {
    const form = new FormData();
    form.append("file", new File([Buffer.from("bad")], "payload.exe"));

    const response = await POST(
      new Request("http://localhost/api/upload", {
        method: "POST",
        body: form,
      }) as never,
    );

    await expect(response.json()).resolves.toEqual({
      error: "unsupported_file_type",
    });
    expect(response.status).toBe(400);
    expect(prepareSourceDocumentIngestion).not.toHaveBeenCalled();
    expect(startPipelineIngest).not.toHaveBeenCalled();
  });

  it("rejects oversized files before preparing ingestion", async () => {
    const form = new FormData();
    form.append(
      "file",
      new File([new Uint8Array(20 * 1024 * 1024 + 1)], "large.md"),
    );

    const response = await POST(
      new Request("http://localhost/api/upload", {
        method: "POST",
        body: form,
      }) as never,
    );

    await expect(response.json()).resolves.toEqual({
      error: "file_too_large",
    });
    expect(response.status).toBe(400);
    expect(prepareSourceDocumentIngestion).not.toHaveBeenCalled();
  });

  it("returns the failed SourceDocument id when pipeline ingest cannot start", async () => {
    prepareSourceDocumentIngestion.mockResolvedValueOnce({
      sourceDocumentId: "doc-failed",
      pipelinePayload: {
        documentId: "doc-failed",
        fileName: "failed.md",
        bytes: Buffer.from("# failed"),
        fileHash: "hash",
        title: "失败上传文件",
        sourceChannel: "live-handshake",
        docType: "notice",
      },
    });
    startPipelineIngest.mockRejectedValueOnce(
      new Error("pipeline_rejected:500:Internal Server Error"),
    );

    const form = new FormData();
    form.append("file", new File([Buffer.from("# failed")], "failed.md"));
    form.append("sourceChannel", "live-handshake");
    const response = await POST(
      new Request("http://localhost/api/upload", {
        method: "POST",
        body: form,
      }) as never,
    );

    await expect(response.json()).resolves.toEqual({
      error: "pipeline_unavailable",
      detail: "Error: pipeline_rejected:500:Internal Server Error",
      sourceDocumentId: "doc-failed",
    });
    expect(response.status).toBe(502);
    expect(markSourceIngestionFailed).toHaveBeenCalledWith(
      "doc-failed",
      { id: "admin-1", roles: ["admin"] },
      "Error: pipeline_rejected:500:Internal Server Error",
    );
  });
});
