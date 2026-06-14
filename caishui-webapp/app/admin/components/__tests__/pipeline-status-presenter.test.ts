import { describe, expect, it } from "vitest";
import { presentPipelineStatusPayload } from "@/app/admin/components/pipeline-status-presenter";

describe("presentPipelineStatusPayload", () => {
  it("projects task status payloads for progress display", () => {
    expect(
      presentPipelineStatusPayload({
        status: "PROCESSING",
        completed_chunks: 1,
        total_chunks: 3,
      }),
    ).toEqual({
      kind: "task",
      status: {
        status: "PROCESSING",
        completed_chunks: 1,
        total_chunks: 3,
      },
    });
  });

  it("projects pipeline transport errors as visible administrator messages", () => {
    expect(
      presentPipelineStatusPayload({
        error: "pipeline_unavailable",
        detail: "network_error:fetch failed",
      }),
    ).toEqual({
      kind: "error",
      message: "network_error:fetch failed",
    });
  });
});
