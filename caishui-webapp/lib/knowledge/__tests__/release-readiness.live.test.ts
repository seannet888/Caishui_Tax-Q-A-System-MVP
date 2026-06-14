import { describe, expect, it } from "vitest";
import { assessReleaseReadiness } from "@/lib/knowledge/release-readiness";
import { formatReleaseReadinessResult } from "@/lib/knowledge/release-readiness-diagnostics";

const enabled =
  process.env.RUN_RELEASE_READINESS === "true" && Boolean(process.env.DATABASE_URL);
const describeReleaseReadiness = enabled ? describe : describe.skip;

describeReleaseReadiness("Release readiness", () => {
  it("passes all release-blocking database assertions", async () => {
    const result = await assessReleaseReadiness();

    if (!result.ok) {
      throw new Error(formatReleaseReadinessResult(result));
    }

    expect(result.ok).toBe(true);
  });
});
