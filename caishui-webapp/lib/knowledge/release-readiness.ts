import { prisma } from "@/lib/db/client";

export type ReleaseReadinessCheckName =
  | "no_auto_verification_method"
  | "no_disputed_verification_status"
  | "failed_answers_have_audit_fields";

export interface ReleaseReadinessCheck {
  name: ReleaseReadinessCheckName;
  ok: boolean;
  count: number;
  severity: "blocker";
}

export interface ReleaseReadinessResult {
  ok: boolean;
  checks: ReleaseReadinessCheck[];
}

export interface ReleaseReadinessStore {
  knowledgeChunk: {
    count(input: { where: Record<string, unknown> }): Promise<number>;
  };
  answer: {
    count(input: { where: Record<string, unknown> }): Promise<number>;
  };
}

export async function assessReleaseReadiness(
  store: ReleaseReadinessStore = prisma,
): Promise<ReleaseReadinessResult> {
  const [autoVerificationChunks, disputedChunks, failedAnswersMissingAudit] =
    await Promise.all([
      store.knowledgeChunk.count({
        where: { verification_method: "auto" },
      }),
      store.knowledgeChunk.count({
        where: { verification_status: "disputed" },
      }),
      store.answer.count({
        where: {
          status: "FAILED",
          OR: [
            { failed_at: null },
            { error_code: null },
            { error_message: null },
          ],
        },
      }),
    ]);

  const checks: ReleaseReadinessCheck[] = [
    createBlockerCheck("no_auto_verification_method", autoVerificationChunks),
    createBlockerCheck("no_disputed_verification_status", disputedChunks),
    createBlockerCheck(
      "failed_answers_have_audit_fields",
      failedAnswersMissingAudit,
    ),
  ];

  return {
    ok: checks.every((check) => check.ok),
    checks,
  };
}

function createBlockerCheck(
  name: ReleaseReadinessCheckName,
  count: number,
): ReleaseReadinessCheck {
  return {
    name,
    ok: count === 0,
    count,
    severity: "blocker",
  };
}
