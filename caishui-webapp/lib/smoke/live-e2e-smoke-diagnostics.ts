import type {
  E2ESmokeHarnessResult,
  SmokeTraceEntry,
} from "@/lib/smoke/e2e-smoke-harness";
import type { LiveE2ESmokePreflightResult } from "@/lib/smoke/live-e2e-smoke-preflight";
import type { LiveE2ESmokeCleanupResult } from "@/lib/smoke/live-e2e-smoke-runner";

export function formatLiveE2ESmokeDisabled(reason: string): string {
  if (reason.startsWith("missing_env:")) {
    const missingKey = reason.slice("missing_env:".length);
    return [
      `Live E2E smoke is disabled because ${missingKey} is not set.`,
      "Set RUN_E2E_SMOKE=true, DATABASE_URL, DATA_PIPELINE_URL, and PIPELINE_SHARED_SECRET before running lib/smoke/__tests__/live-e2e-smoke.test.ts.",
    ].join("\n");
  }

  return [
    "Live E2E smoke is opt-in and is currently skipped because RUN_E2E_SMOKE is not true.",
    "Set RUN_E2E_SMOKE=true, DATABASE_URL, DATA_PIPELINE_URL, and PIPELINE_SHARED_SECRET to exercise the real WebApp -> Pipeline -> DB path.",
  ].join("\n");
}

export function formatLiveE2ESmokeFailure(
  result: Extract<E2ESmokeHarnessResult, { ok: false }>,
): string {
  return [
    `live_e2e_smoke_failed:${result.failedStep}:${result.reason}`,
    `sourceDocumentId: ${result.sourceDocumentId ?? "unknown"}`,
    `taskId: ${result.taskId ?? "unknown"}`,
    "trace:",
    ...result.trace.map(formatTraceEntry),
  ].join("\n");
}

export function formatLiveE2ESmokePreflightFailure(
  result: Extract<LiveE2ESmokePreflightResult, { ok: false }>,
): string {
  return [
    `live_e2e_smoke_preflight_failed:${result.reason}`,
    "failed checks:",
    ...result.failures.map(
      (failure) => `- ${failure.check}: ${failure.reason}`,
    ),
  ].join("\n");
}

export function formatLiveE2ESmokeCleanupFailure(
  result: Extract<LiveE2ESmokeCleanupResult, { ok: false }>,
): string {
  const residualRows = result.residualRows
    ? `residualRows: sourceDocuments=${result.residualRows.sourceDocuments}, knowledgeChunks=${result.residualRows.knowledgeChunks}, ingestTasks=${result.residualRows.ingestTasks}`
    : "residualRows: unknown";
  return [
    `live_e2e_smoke_cleanup_failed:${result.reason}`,
    `sourceDocumentId: ${result.sourceDocumentId}`,
    residualRows,
    "Disposable smoke rows may remain in source_documents, knowledge_chunks, or ingest_tasks.",
  ].join("\n");
}

function formatTraceEntry(entry: SmokeTraceEntry): string {
  const details = [
    entry.targetId ? `target=${entry.targetId}` : undefined,
    entry.reason ? `reason=${entry.reason}` : undefined,
  ].filter(Boolean);
  return `- ${entry.step}: ${entry.status}${details.length ? ` (${details.join(", ")})` : ""}`;
}
