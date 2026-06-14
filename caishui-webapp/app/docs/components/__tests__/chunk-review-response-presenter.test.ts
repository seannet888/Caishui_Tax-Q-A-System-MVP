import { describe, expect, it } from "vitest";
import { presentChunkReviewResponse } from "@/app/docs/components/chunk-review-response-presenter";

describe("presentChunkReviewResponse", () => {
  it("returns no message when verification and embedding queueing both succeed", () => {
    expect(
      presentChunkReviewResponse({
        ok: true,
        embedding: { ok: true, status: "QUEUED" },
      }),
    ).toEqual({ ok: true, message: null });
  });

  it("warns when verification is saved but embedding trigger fails", () => {
    expect(
      presentChunkReviewResponse({
        ok: true,
        embedding: {
          ok: false,
          status: "FAILED",
          error: "pipeline_embedding_rejected:0:network_error:fetch failed",
        },
      }),
    ).toEqual({
      ok: true,
      message:
        "核验已保存，但向量化任务未启动：pipeline_embedding_rejected:0:network_error:fetch failed",
    });
  });

  it("projects route errors as failed review messages", () => {
    expect(
      presentChunkReviewResponse({
        error: "Error: forbidden_requires_role:reviewer",
      }),
    ).toEqual({
      ok: false,
      message: "Error: forbidden_requires_role:reviewer",
    });
  });
});
