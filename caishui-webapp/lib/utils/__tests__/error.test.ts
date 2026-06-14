import { describe, expect, it } from "vitest";
import { getErrorMessage } from "@/lib/utils/error";

describe("getErrorMessage", () => {
  it("uses Error.message for Error objects", () => {
    expect(getErrorMessage(new Error("provider unavailable"))).toBe(
      "provider unavailable",
    );
  });

  it("stringifies non-Error values", () => {
    expect(getErrorMessage("plain failure")).toBe("plain failure");
  });
});
