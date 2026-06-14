import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import {
  formatLiveE2ESmokeRunbook,
  getLiveE2ESmokeRunbook,
} from "@/lib/smoke/live-e2e-smoke-runbook";
import packageJson from "@/package.json";

describe("getLiveE2ESmokeRunbook", () => {
  it("reports missing environment variables and the stable script entry", () => {
    const runbook = getLiveE2ESmokeRunbook({
      DATABASE_URL: "postgresql://local",
    });

    expect(runbook.command).toBe("pnpm smoke:e2e:live");
    expect(runbook.requiredEnv).toEqual([
      "DATABASE_URL",
      "DATA_PIPELINE_URL",
      "PIPELINE_SHARED_SECRET",
    ]);
    expect(runbook.missingEnv).toEqual([
      "DATA_PIPELINE_URL",
      "PIPELINE_SHARED_SECRET",
    ]);
    expect(runbook.prerequisites).toContain("data-pipeline /health is reachable");
    expect(runbook.prerequisites).toContain("WebApp DATABASE_URL points at the migrated Postgres database");
  });

  it("formats a copyable runbook for operators", () => {
    const message = formatLiveE2ESmokeRunbook(
      getLiveE2ESmokeRunbook({
        DATABASE_URL: "postgresql://local",
        DATA_PIPELINE_URL: "http://127.0.0.1:8000",
        PIPELINE_SHARED_SECRET: "local-smoke-secret",
      }),
    );

    expect(message).toContain("pnpm smoke:e2e:live");
    expect(message).toContain("DATABASE_URL");
    expect(message).toContain("DATA_PIPELINE_URL");
    expect(message).toContain("PIPELINE_SHARED_SECRET");
    expect(message).toContain("no missing environment variables");
  });
});

describe("package script entry", () => {
  it("exposes the live E2E smoke runner as a stable script", () => {
    expect(packageJson.scripts["smoke:e2e:live"]).toBe(
      "node scripts/run-live-e2e-smoke.mjs",
    );
  });
});

describe("run-live-e2e-smoke CLI preflight", () => {
  it("reports an unreachable pipeline before running the live smoke test", () => {
    const env = {
      ...process.env,
      DATABASE_URL: "postgresql://caishui:localdev_password@127.0.0.1:1/caishui_db",
      DATA_PIPELINE_URL: "http://127.0.0.1:1",
      PIPELINE_SHARED_SECRET: "local-smoke-secret",
    };

    const result = spawnSync("node", ["scripts/run-live-e2e-smoke.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Live E2E smoke preflight failed");
    expect(result.stderr).toContain("Command: pnpm smoke:e2e:live");
    expect(result.stderr).toContain("pipeline /health unreachable");
    expect(result.stderr).not.toContain("lib/smoke/__tests__/live-e2e-smoke.test.ts");
  });
});
