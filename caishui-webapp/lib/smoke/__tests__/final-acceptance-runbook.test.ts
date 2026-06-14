import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import {
  formatFinalAcceptanceExecutionPlan,
  formatFinalAcceptanceRunbook,
  getFinalAcceptanceRunbook,
  planFinalAcceptanceExecution,
} from "@/lib/smoke/final-acceptance-runbook";

describe("getFinalAcceptanceRunbook", () => {
  it("orders final acceptance checks from offline validation to live provider checks", () => {
    const runbook = getFinalAcceptanceRunbook({
      DATABASE_URL: "postgresql://local",
      DATA_PIPELINE_URL: "http://127.0.0.1:8000",
      PIPELINE_SHARED_SECRET: "secret",
      EMBEDDING_API_KEY: "embedding-key",
      DEEPSEEK_API_KEY: "deepseek-key",
    });

    expect(runbook.steps.map((step) => step.command)).toEqual([
      "pnpm vitest run prisma/__tests__/migration-contract.test.ts",
      "pnpm vitest run lib/pipeline/__tests__/contract-parity.test.ts",
      "pnpm typecheck",
      "pnpm test",
      "$env:NEXT_DISABLE_STANDALONE=\"true\"; pnpm build",
      "pnpm release:readiness",
      "pnpm smoke:e2e:live",
      "pnpm smoke:providers",
    ]);
    expect(runbook.steps.at(-1)?.validates).toContain(
      "Provider credentials and response shape only; not WebApp/Pipeline/DB",
    );
  });

  it("documents the Windows build preflight to avoid dev/build .next collisions", () => {
    const runbook = getFinalAcceptanceRunbook({});
    const buildStep = runbook.steps.find((step) =>
      step.command.includes("pnpm build"),
    );

    expect(buildStep?.validates).toContain("Stop any dev server");
    expect(buildStep?.validates).toContain("remove .next");
  });
});

describe("formatFinalAcceptanceRunbook", () => {
  it("prints missing environment variables and action-oriented steps", () => {
    const text = formatFinalAcceptanceRunbook(getFinalAcceptanceRunbook({}));

    expect(text).toContain("Final local acceptance runbook");
    expect(text).toContain("Missing env: DATABASE_URL");
    expect(text).toContain("Missing env: DATA_PIPELINE_URL");
    expect(text).toContain("1. pnpm vitest run prisma/__tests__/migration-contract.test.ts");
    expect(text).toContain("2. pnpm vitest run lib/pipeline/__tests__/contract-parity.test.ts");
    expect(text).toContain("8. pnpm smoke:providers");
  });
});

describe("planFinalAcceptanceExecution", () => {
  it("separates runnable offline steps from env-blocked live checks", () => {
    const plan = planFinalAcceptanceExecution(getFinalAcceptanceRunbook({}));

    expect(plan.runnableSteps.map((step) => step.command)).toEqual([
      "pnpm vitest run prisma/__tests__/migration-contract.test.ts",
      "pnpm vitest run lib/pipeline/__tests__/contract-parity.test.ts",
      "pnpm typecheck",
      "pnpm test",
      "$env:NEXT_DISABLE_STANDALONE=\"true\"; pnpm build",
    ]);
    expect(plan.blockedSteps.map((step) => step.command)).toEqual([
      "pnpm release:readiness",
      "pnpm smoke:e2e:live",
      "pnpm smoke:providers",
    ]);
    expect(plan.summary).toBe(
      "Runnable: 5 step(s). Blocked by missing env: 3 step(s).",
    );
  });
});

describe("formatFinalAcceptanceExecutionPlan", () => {
  it("prints runnable and blocked commands for the current environment", () => {
    const text = formatFinalAcceptanceExecutionPlan(
      planFinalAcceptanceExecution(getFinalAcceptanceRunbook({})),
    );

    expect(text).toContain("Runnable: 5 step(s). Blocked by missing env: 3 step(s).");
    expect(text).toContain("Runnable steps");
    expect(text).toContain("1. pnpm vitest run prisma/__tests__/migration-contract.test.ts");
    expect(text).toContain("Blocked steps");
    expect(text).toContain("pnpm release:readiness");
    expect(text).toContain("Missing env: DATABASE_URL");
  });
});

describe("print final acceptance plan CLI", () => {
  it("prints runnable and blocked steps without requiring live environment", () => {
    const env = { ...process.env };
    delete env.DATABASE_URL;
    delete env.DATA_PIPELINE_URL;
    delete env.PIPELINE_SHARED_SECRET;
    delete env.EMBEDDING_API_KEY;
    delete env.DEEPSEEK_API_KEY;

    const result = spawnSync("node", ["--no-warnings", "scripts/print-final-acceptance-plan.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Runnable: 5 step(s). Blocked by missing env: 3 step(s).");
    expect(result.stdout).toContain("Runnable steps");
    expect(result.stdout).toContain("Blocked steps");
    expect(result.stderr).toBe("");
  });
});
