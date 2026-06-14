import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import {
  formatReleaseReadinessResult,
  getReleaseReadinessRunbook,
} from "@/lib/knowledge/release-readiness-diagnostics";

describe("formatReleaseReadinessResult", () => {
  it("formats passing release readiness checks", () => {
    expect(
      formatReleaseReadinessResult({
        ok: true,
        checks: [
          {
            name: "no_auto_verification_method",
            ok: true,
            count: 0,
            severity: "blocker",
          },
        ],
      }),
    ).toContain("Release readiness passed");
  });

  it("formats blocker diagnostics with action hints", () => {
    const text = formatReleaseReadinessResult({
      ok: false,
      checks: [
        {
          name: "no_auto_verification_method",
          ok: false,
          count: 2,
          severity: "blocker",
        },
      ],
    });

    expect(text).toContain("Release readiness failed");
    expect(text).toContain("no_auto_verification_method: failed count=2");
    expect(text).toContain("Action: remove or reclassify auto verification_method");
  });
});

describe("getReleaseReadinessRunbook", () => {
  it("reports missing database url and stable command", () => {
    const text = getReleaseReadinessRunbook({});

    expect(text).toContain("Release readiness runbook");
    expect(text).toContain("Command: pnpm release:readiness");
    expect(text).toContain("Missing env: DATABASE_URL");
  });
});

describe("run-release-readiness CLI preflight", () => {
  it("reports an unreachable database before running the live readiness test", () => {
    const env = {
      ...process.env,
      DATABASE_URL: "postgresql://caishui:localdev_password@127.0.0.1:1/caishui_db",
    };

    const result = spawnSync("node", ["scripts/run-release-readiness.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Release readiness database preflight failed");
    expect(result.stderr).toContain("Command: pnpm release:readiness");
    expect(result.stderr).toContain("DATABASE_URL host: 127.0.0.1:1");
    expect(result.stderr).not.toContain("PrismaClientInitializationError");
  });
});
