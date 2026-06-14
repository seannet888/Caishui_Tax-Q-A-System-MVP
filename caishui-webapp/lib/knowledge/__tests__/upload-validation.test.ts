import { describe, expect, it } from "vitest";
import {
  UploadValidationError,
  validateUploadedFile,
} from "@/lib/knowledge/upload-validation";

describe("upload validation", () => {
  it("rejects empty files with a safe error code", () => {
    expect(() =>
      validateUploadedFile({ name: "empty.md", size: 0 }),
    ).toThrow(new UploadValidationError("empty_file"));
  });

  it("accepts MVP supported extensions case-insensitively", () => {
    expect(() =>
      validateUploadedFile({ name: "POLICY.PDF", size: 1 }),
    ).not.toThrow();
  });
});
