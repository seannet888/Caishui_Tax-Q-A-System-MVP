import type {
  ReleaseReadinessCheck,
  ReleaseReadinessResult,
} from "@/lib/knowledge/release-readiness";

type ReleaseReadinessEnv = Record<string, string | undefined>;

export function formatReleaseReadinessResult(
  result: ReleaseReadinessResult,
): string {
  if (result.ok) {
    return [
      "Release readiness passed",
      ...result.checks.map(formatCheckLine),
    ].join("\n");
  }
  return [
    "Release readiness failed",
    ...result.checks.map(formatCheckLine),
    ...result.checks.filter((check) => !check.ok).map(formatActionLine),
  ].join("\n");
}

export function getReleaseReadinessRunbook(
  env: ReleaseReadinessEnv = process.env,
): string {
  const missingEnv = env.DATABASE_URL ? [] : ["DATABASE_URL"];
  return [
    "Release readiness runbook",
    "Command: pnpm release:readiness",
    "Required env: DATABASE_URL",
    missingEnv.length ? `Missing env: ${missingEnv.join(", ")}` : "Missing env: none",
    "What this validates:",
    "- no chunks with verification_method='auto'",
    "- no chunks with verification_status='disputed'",
    "- failed answers have failed_at, error_code, and error_message",
  ].join("\n");
}

function formatCheckLine(check: ReleaseReadinessCheck): string {
  return `${check.name}: ${check.ok ? "ok" : "failed"} count=${check.count} severity=${check.severity}`;
}

function formatActionLine(check: ReleaseReadinessCheck): string {
  if (check.name === "no_auto_verification_method") {
    return "Action: remove or reclassify auto verification_method records; MVP forbids auto verification output.";
  }
  if (check.name === "no_disputed_verification_status") {
    return "Action: resolve or reclassify disputed chunks; MVP must not ship disputed verification status.";
  }
  if (check.name === "failed_answers_have_audit_fields") {
    return "Action: backfill failed_at, error_code, and error_message on FAILED answers before release.";
  }
  return `Action: inspect release readiness check ${check.name}.`;
}
