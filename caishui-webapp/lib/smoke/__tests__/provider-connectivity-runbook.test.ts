import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { getProviderConnectivityRunbook } from "@/lib/smoke/provider-connectivity-runbook";

describe("getProviderConnectivityRunbook", () => {
  it("reports missing provider environment variables and the stable script entry", () => {
    expect(
      getProviderConnectivityRunbook({
        RUN_PROVIDER_SMOKE: "true",
        DEEPSEEK_API_KEY: "deepseek-key",
      }),
    ).toContain("Missing env: EMBEDDING_API_KEY");
  });

  it("formats a copyable runbook for operators", () => {
    const text = getProviderConnectivityRunbook({});

    expect(text).toContain("Provider connectivity smoke runbook");
    expect(text).toContain("Command: pnpm smoke:providers");
    expect(text).toContain("RUN_PROVIDER_SMOKE");
    expect(text).toContain("EMBEDDING_API_KEY");
    expect(text).toContain("DEEPSEEK_API_KEY");
  });

  it("provider smoke script reports only operator-supplied missing env", () => {
    const env = { ...process.env };
    delete env.EMBEDDING_API_KEY;
    delete env.DEEPSEEK_API_KEY;
    delete env.RUN_PROVIDER_SMOKE;

    const result = spawnSync(process.execPath, ["scripts/run-provider-smoke.mjs"], {
      cwd: process.cwd(),
      env,
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Required env: EMBEDDING_API_KEY, DEEPSEEK_API_KEY");
    expect(result.stderr).toContain("Missing env: EMBEDDING_API_KEY, DEEPSEEK_API_KEY");
    expect(result.stderr).toContain("RUN_PROVIDER_SMOKE is set automatically");
    expect(result.stderr).not.toContain("Missing env: RUN_PROVIDER_SMOKE");
  });
});
