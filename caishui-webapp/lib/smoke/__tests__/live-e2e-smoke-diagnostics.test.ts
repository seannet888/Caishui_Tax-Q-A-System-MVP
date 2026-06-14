import { describe, expect, it } from "vitest";
import {
  formatLiveE2ESmokeDisabled,
  formatLiveE2ESmokeFailure,
  formatLiveE2ESmokePreflightFailure,
  formatLiveE2ESmokeCleanupFailure,
} from "@/lib/smoke/live-e2e-smoke-diagnostics";

describe("formatLiveE2ESmokeDisabled", () => {
  it("explains opt-in when the live smoke flag is not enabled", () => {
    const message = formatLiveE2ESmokeDisabled("RUN_E2E_SMOKE_not_true");

    expect(message).toContain("RUN_E2E_SMOKE");
    expect(message).toContain("true");
    expect(message).toContain("DATABASE_URL");
    expect(message).toContain("DATA_PIPELINE_URL");
    expect(message).toContain("PIPELINE_SHARED_SECRET");
  });

  it("names the missing environment variable", () => {
    expect(
      formatLiveE2ESmokeDisabled("missing_env:PIPELINE_SHARED_SECRET"),
    ).toContain("PIPELINE_SHARED_SECRET");
  });
});

describe("formatLiveE2ESmokePreflightFailure", () => {
  it("lists all failed readiness checks", () => {
    const message = formatLiveE2ESmokePreflightFailure({
      ok: false,
      reason: "preflight_failed",
      failures: [
        { check: "pipeline_health", reason: "pipeline_health_500" },
        { check: "database", reason: "database_unreachable:timeout" },
      ],
    });

    expect(message).toContain("preflight_failed");
    expect(message).toContain("pipeline_health: pipeline_health_500");
    expect(message).toContain("database: database_unreachable:timeout");
  });
});

describe("formatLiveE2ESmokeCleanupFailure", () => {
  it("explains cleanup failure without losing the source identity", () => {
    const message = formatLiveE2ESmokeCleanupFailure({
      ok: false,
      sourceDocumentId: "doc-smoke",
      reason: "delete ingest_tasks failed",
      residualRows: {
        sourceDocuments: 0,
        knowledgeChunks: 2,
        ingestTasks: 0,
      },
    });

    expect(message).toContain("live_e2e_smoke_cleanup_failed");
    expect(message).toContain("doc-smoke");
    expect(message).toContain("delete ingest_tasks failed");
    expect(message).toContain("knowledgeChunks=2");
  });
});

describe("formatLiveE2ESmokeFailure", () => {
  it("includes the failed step, reason, identities, and trace", () => {
    const message = formatLiveE2ESmokeFailure({
      ok: false,
      failedStep: "accepted_task_readiness",
      sourceDocumentId: "src_live_1",
      taskId: "task_live_1",
      reason: "pipeline_status_task_not_found",
      trace: [
        { step: "upload_source", status: "passed" },
        {
          step: "accepted_task_readiness",
          status: "failed",
          reason: "pipeline_status_task_not_found",
        },
      ],
    });

    expect(message).toContain("accepted_task_readiness");
    expect(message).toContain("pipeline_status_task_not_found");
    expect(message).toContain("src_live_1");
    expect(message).toContain("task_live_1");
    expect(message).toContain("upload_source: passed");
    expect(message).toContain("accepted_task_readiness: failed");
  });
});
