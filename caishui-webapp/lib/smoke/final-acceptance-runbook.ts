import { formatList, formatMissing, unique } from "./runbook-format.js";

type FinalAcceptanceEnv = Record<string, string | undefined>;

export interface FinalAcceptanceStep {
  command: string;
  validates: string;
  requiredEnv: string[];
  missingEnv: string[];
}

export interface FinalAcceptanceRunbook {
  title: string;
  steps: FinalAcceptanceStep[];
}

export interface FinalAcceptanceExecutionPlan {
  runnableSteps: FinalAcceptanceStep[];
  blockedSteps: FinalAcceptanceStep[];
  summary: string;
}

const WINDOWS_LOCAL_BUILD_COMMAND =
  '$env:NEXT_DISABLE_STANDALONE="true"; pnpm build';

export function getFinalAcceptanceRunbook(
  env: FinalAcceptanceEnv = process.env,
): FinalAcceptanceRunbook {
  const steps: FinalAcceptanceStep[] = [
    createStep({
      command: "pnpm vitest run prisma/__tests__/migration-contract.test.ts",
      validates: "Offline Prisma migration contract keeps manual DDL folded",
      requiredEnv: [],
      env,
    }),
    createStep({
      command: "pnpm vitest run lib/pipeline/__tests__/contract-parity.test.ts",
      validates: "WebApp TypeScript and Pipeline Pydantic JSON contracts stay mirrored",
      requiredEnv: [],
      env,
    }),
    createStep({
      command: "pnpm typecheck",
      validates: "TypeScript and public module contracts compile",
      requiredEnv: [],
      env,
    }),
    createStep({
      command: "pnpm test",
      validates: "Offline WebApp behavior tests pass using forked Vitest workers",
      requiredEnv: [],
      env,
    }),
    createStep({
      command: WINDOWS_LOCAL_BUILD_COMMAND,
      validates:
        "Stop any dev server and remove .next before running the local Next.js production build without Windows standalone symlinks",
      requiredEnv: [],
      env,
    }),
    createStep({
      command: "pnpm release:readiness",
      validates: "Release-blocking DB assertions are clean",
      requiredEnv: ["DATABASE_URL"],
      env,
    }),
    createStep({
      command: "pnpm smoke:e2e:live",
      validates: "WebApp/Pipeline/DB live path with deterministic retrieval and answer",
      requiredEnv: [
        "DATABASE_URL",
        "DATA_PIPELINE_URL",
        "PIPELINE_SHARED_SECRET",
      ],
      env,
    }),
    createStep({
      command: "pnpm smoke:providers",
      validates: "Provider credentials and response shape only; not WebApp/Pipeline/DB",
      requiredEnv: ["EMBEDDING_API_KEY", "DEEPSEEK_API_KEY"],
      env,
    }),
  ];

  return {
    title: "Final local acceptance runbook",
    steps,
  };
}

export function formatFinalAcceptanceRunbook(
  runbook: FinalAcceptanceRunbook,
): string {
  const missingEnv = unique(runbook.steps.flatMap((step) => step.missingEnv));

  return [
    runbook.title,
    ...missingEnv.map((key) => `Missing env: ${key}`),
    ...runbook.steps.flatMap((step, index) => [
      `${index + 1}. ${step.command}`,
      `   Validates: ${step.validates}`,
      `   Required env: ${formatList(step.requiredEnv)}`,
      `   Missing env: ${formatMissing(step.missingEnv)}`,
    ]),
  ].join("\n");
}

export function planFinalAcceptanceExecution(
  runbook: FinalAcceptanceRunbook,
): FinalAcceptanceExecutionPlan {
  const runnableSteps = runbook.steps.filter(
    (step) => step.missingEnv.length === 0,
  );
  const blockedSteps = runbook.steps.filter(
    (step) => step.missingEnv.length > 0,
  );

  return {
    runnableSteps,
    blockedSteps,
    summary: `Runnable: ${runnableSteps.length} step(s). Blocked by missing env: ${blockedSteps.length} step(s).`,
  };
}

export function formatFinalAcceptanceExecutionPlan(
  plan: FinalAcceptanceExecutionPlan,
): string {
  return [
    plan.summary,
    "Runnable steps",
    ...plan.runnableSteps.map((step, index) => `${index + 1}. ${step.command}`),
    "Blocked steps",
    ...plan.blockedSteps.flatMap((step) => [
      `- ${step.command}`,
      `  Missing env: ${formatMissing(step.missingEnv)}`,
    ]),
  ].join("\n");
}

function createStep(input: {
  command: string;
  validates: string;
  requiredEnv: string[];
  env: FinalAcceptanceEnv;
}): FinalAcceptanceStep {
  return {
    command: input.command,
    validates: input.validates,
    requiredEnv: input.requiredEnv,
    missingEnv: input.requiredEnv.filter((key) => !input.env[key]),
  };
}
