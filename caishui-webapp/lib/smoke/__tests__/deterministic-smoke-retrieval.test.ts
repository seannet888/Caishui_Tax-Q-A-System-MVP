import { describe, expect, it } from "vitest";
import { retrieveVerifiedSmokeChunks } from "@/lib/smoke/deterministic-smoke-retrieval";

describe("retrieveVerifiedSmokeChunks", () => {
  it("returns the chunks verified during the current smoke run without provider lookup", () => {
    expect(
      retrieveVerifiedSmokeChunks({
        verifiedChunkIds: ["chunk-1", "chunk-2"],
      }),
    ).toEqual({
      chunks: [{ id: "chunk-1" }, { id: "chunk-2" }],
    });
  });
});
