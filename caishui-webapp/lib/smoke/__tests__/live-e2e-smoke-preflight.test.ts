import { describe, expect, it, vi } from "vitest";
import {
  createDefaultLiveE2ESmokePreflightChecks,
  runLiveE2ESmokePreflight,
  type LiveE2ESmokePreflightCheck,
} from "@/lib/smoke/live-e2e-smoke-preflight";

const pass = () => vi.fn(async (): Promise<{ ok: true }> => ({ ok: true }));

describe("runLiveE2ESmokePreflight", () => {
  it("fails before running checks when required live env is missing", async () => {
    const checks: LiveE2ESmokePreflightCheck[] = [
      { name: "pipeline_health", run: pass() },
    ];

    const result = await runLiveE2ESmokePreflight({
      env: { RUN_E2E_SMOKE: "true" },
      checks,
    });

    expect(result).toEqual({
      ok: false,
      reason: "missing_env:DATABASE_URL",
      failures: [
        { check: "environment", reason: "missing_env:DATABASE_URL" },
      ],
    });
    expect(checks[0]!.run).not.toHaveBeenCalled();
  });

  it("reports failing readiness checks without hiding later checks", async () => {
    const result = await runLiveE2ESmokePreflight({
      env: {
        RUN_E2E_SMOKE: "true",
        DATABASE_URL: "postgresql://local",
        DATA_PIPELINE_URL: "http://127.0.0.1:8000",
        PIPELINE_SHARED_SECRET: "local-smoke-secret",
      },
      checks: [
        {
          name: "pipeline_health",
          run: vi.fn(async () => ({
            ok: false,
            reason: "pipeline_health_500",
          })),
        },
        { name: "database", run: pass() },
      ],
    });

    expect(result).toEqual({
      ok: false,
      reason: "preflight_failed",
      failures: [{ check: "pipeline_health", reason: "pipeline_health_500" }],
    });
  });

  it("passes when env and all readiness checks pass", async () => {
    await expect(
      runLiveE2ESmokePreflight({
        env: {
          RUN_E2E_SMOKE: "true",
          DATABASE_URL: "postgresql://local",
          DATA_PIPELINE_URL: "http://127.0.0.1:8000",
          PIPELINE_SHARED_SECRET: "local-smoke-secret",
        },
        checks: [
          { name: "pipeline_health", run: pass() },
          { name: "database", run: pass() },
        ],
      }),
    ).resolves.toEqual({ ok: true });
  });
});

describe("createDefaultLiveE2ESmokePreflightChecks", () => {
  it("checks pipeline health through the configured pipeline URL", async () => {
    const fetchImpl = vi.fn(async () => new Response("ok", { status: 200 }));
    const checks = createDefaultLiveE2ESmokePreflightChecks({
      env: { DATA_PIPELINE_URL: "http://127.0.0.1:8000/" },
      fetchImpl,
      dbPing: vi.fn(async () => undefined),
    });

    await expect(checks[0]!.run()).resolves.toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledWith("http://127.0.0.1:8000/health", {
      method: "GET",
    });
  });

  it("reports pipeline health and database failures", async () => {
    const checks = createDefaultLiveE2ESmokePreflightChecks({
      env: { DATA_PIPELINE_URL: "http://127.0.0.1:8000" },
      fetchImpl: vi.fn(async () => new Response("nope", { status: 500 })),
      dbPing: vi.fn(async () => {
        throw new Error("connection refused");
      }),
    });

    await expect(checks[0]!.run()).resolves.toEqual({
      ok: false,
      reason: "pipeline_health_500",
    });
    await expect(checks[1]!.run()).resolves.toEqual({
      ok: false,
      reason: "database_unreachable:connection refused",
    });
  });
});
