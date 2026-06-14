import { describe, expect, it } from "vitest";
import { readPipelineContractParity } from "@/lib/pipeline/contract-parity";

describe("pipeline contract parity", () => {
  it("keeps closed enums and PipelineOutput fields mirrored across engines", () => {
    const parity = readPipelineContractParity();

    expect(parity.typescript.docTypeValues).toEqual(parity.python.docTypeValues);
    expect(parity.typescript.chunkTypeValues).toEqual(
      parity.python.chunkTypeValues,
    );
    expect(parity.typescript.pipelineOutputFields).toEqual(
      parity.python.pipelineOutputFields,
    );
  });

  it("keeps ChunkOutput and TaxMetadata fields mirrored across engines", () => {
    const parity = readPipelineContractParity();

    expect(parity.typescript.chunkOutputFields).toContain("content_hash");
    expect(parity.typescript.taxMetadataFields).toContain("publish_date");
    expect(parity.typescript.chunkOutputFields).toEqual(
      parity.python.chunkOutputFields,
    );
    expect(parity.typescript.taxMetadataFields).toEqual(
      parity.python.taxMetadataFields,
    );
  });
});
