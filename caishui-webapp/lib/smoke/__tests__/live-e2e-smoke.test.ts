import { describe, expect, it } from "vitest";
import {
  createLiveE2ESmokeRunner,
  isLiveE2ESmokeEnabled,
} from "@/lib/smoke/live-e2e-smoke-runner";
import {
  formatLiveE2ESmokeCleanupFailure,
  formatLiveE2ESmokeFailure,
  formatLiveE2ESmokePreflightFailure,
} from "@/lib/smoke/live-e2e-smoke-diagnostics";
import {
  createDefaultLiveE2ESmokePreflightChecks,
  runLiveE2ESmokePreflight,
} from "@/lib/smoke/live-e2e-smoke-preflight";

const liveE2E = isLiveE2ESmokeEnabled();
const describeLiveE2E = liveE2E.enabled ? describe : describe.skip;

describeLiveE2E("Live E2E smoke", () => {
  it("runs the opt-in upload-to-answer smoke path", async () => {
    const preflight = await runLiveE2ESmokePreflight({
      checks: createDefaultLiveE2ESmokePreflightChecks(),
    });
    if (!preflight.ok) {
      throw new Error(formatLiveE2ESmokePreflightFailure(preflight));
    }

    const result = await createLiveE2ESmokeRunner().run();

    expect(result.trace.length).toBeGreaterThan(0);
    if (result.cleanup && !result.cleanup.ok) {
      throw new Error(formatLiveE2ESmokeCleanupFailure(result.cleanup));
    }
    if (!result.ok) {
      throw new Error(formatLiveE2ESmokeFailure(result));
    }
    expect(result.sourceDocumentId).toBeTruthy();
    expect(result.taskId).toBeTruthy();
  }, 60_000);
});
