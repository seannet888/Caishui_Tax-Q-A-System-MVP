import { describe, expect, it } from "vitest";
import { presentUploadFailure } from "@/app/admin/components/upload-response-presenter";

describe("presentUploadFailure", () => {
  it("shows pipeline failure detail and keeps failed document link target", () => {
    expect(
      presentUploadFailure({
        error: "pipeline_unavailable",
        detail: "Error: pipeline_rejected:0:network_error:fetch failed",
        sourceDocumentId: "doc-failed",
      }),
    ).toEqual({
      message: "Error: pipeline_rejected:0:network_error:fetch failed",
      failedDocumentId: "doc-failed",
    });
  });

  it("falls back to the stable error code when detail is absent", () => {
    expect(
      presentUploadFailure({
        error: "source_document_already_exists",
      }),
    ).toEqual({
      message: "source_document_already_exists",
      failedDocumentId: null,
    });
  });
});
