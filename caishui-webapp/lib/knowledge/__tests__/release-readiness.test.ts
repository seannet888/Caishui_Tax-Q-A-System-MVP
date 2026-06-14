import { describe, expect, it } from "vitest";
import { assessReleaseReadiness } from "@/lib/knowledge/release-readiness";

describe("assessReleaseReadiness", () => {
  it("passes when all release-blocking data assertions are clean", async () => {
    const store = createStore({
      autoVerificationChunks: 0,
      disputedChunks: 0,
      failedAnswersMissingAudit: 0,
    });

    await expect(assessReleaseReadiness(store)).resolves.toEqual({
      ok: true,
      checks: [
        {
          name: "no_auto_verification_method",
          ok: true,
          count: 0,
          severity: "blocker",
        },
        {
          name: "no_disputed_verification_status",
          ok: true,
          count: 0,
          severity: "blocker",
        },
        {
          name: "failed_answers_have_audit_fields",
          ok: true,
          count: 0,
          severity: "blocker",
        },
      ],
    });
  });

  it("fails when MVP-forbidden or unauditable records exist", async () => {
    const store = createStore({
      autoVerificationChunks: 2,
      disputedChunks: 1,
      failedAnswersMissingAudit: 3,
    });

    await expect(assessReleaseReadiness(store)).resolves.toEqual({
      ok: false,
      checks: [
        {
          name: "no_auto_verification_method",
          ok: false,
          count: 2,
          severity: "blocker",
        },
        {
          name: "no_disputed_verification_status",
          ok: false,
          count: 1,
          severity: "blocker",
        },
        {
          name: "failed_answers_have_audit_fields",
          ok: false,
          count: 3,
          severity: "blocker",
        },
      ],
    });
  });
});

function createStore(counts: {
  autoVerificationChunks: number;
  disputedChunks: number;
  failedAnswersMissingAudit: number;
}) {
  return {
    knowledgeChunk: {
      count: async ({ where }: { where: Record<string, unknown> }) => {
        if (where.verification_method === "auto") {
          return counts.autoVerificationChunks;
        }
        if (where.verification_status === "disputed") {
          return counts.disputedChunks;
        }
        throw new Error(`unexpected chunk count query:${JSON.stringify(where)}`);
      },
    },
    answer: {
      count: async ({ where }: { where: Record<string, unknown> }) => {
        expect(where).toEqual({
          status: "FAILED",
          OR: [
            { failed_at: null },
            { error_code: null },
            { error_message: null },
          ],
        });
        return counts.failedAnswersMissingAudit;
      },
    },
  };
}
