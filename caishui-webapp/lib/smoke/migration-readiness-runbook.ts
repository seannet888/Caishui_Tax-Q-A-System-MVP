import { formatList, formatMissing, unique } from "./runbook-format.js";

type MigrationReadinessEnv = Record<string, string | undefined>;

export interface MigrationReadinessStep {
  command: string;
  mode: "offline" | "live-db";
  validates: string;
  requiredEnv: string[];
  missingEnv: string[];
}

export interface MigrationReadinessRunbook {
  title: string;
  warning: string;
  steps: MigrationReadinessStep[];
}

export function getMigrationReadinessRunbook(
  env: MigrationReadinessEnv = process.env,
): MigrationReadinessRunbook {
  const steps: MigrationReadinessStep[] = [
    createStep({
      command: "pnpm vitest run prisma/__tests__/migration-contract.test.ts",
      mode: "offline",
      validates:
        "Initial migration still folds pgvector, HNSW, ingest_tasks, and manual invariants",
      requiredEnv: [],
      env,
    }),
    createStep({
      command: "pnpm prisma migrate status",
      mode: "live-db",
      validates: "Target database migration history is visible to Prisma",
      requiredEnv: ["DATABASE_URL"],
      env,
    }),
    createStep({
      command:
        "pnpm prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url $env:SHADOW_DATABASE_URL",
      mode: "live-db",
      validates: "Migration files and Prisma schema do not drift",
      requiredEnv: ["SHADOW_DATABASE_URL"],
      env,
    }),
    createStep({
      command: "pnpm prisma migrate deploy",
      mode: "live-db",
      validates: "Release database can apply committed migrations",
      requiredEnv: ["DATABASE_URL"],
      env,
    }),
  ];

  return {
    title: "Migration readiness runbook",
    warning: "Single DDL owner: Prisma migrations only; no Alembic/create_all",
    steps,
  };
}

export function formatMigrationReadinessRunbook(
  runbook: MigrationReadinessRunbook,
): string {
  const missingEnv = unique(runbook.steps.flatMap((step) => step.missingEnv));

  return [
    runbook.title,
    runbook.warning,
    ...missingEnv.map((key) => `Missing env: ${key}`),
    ...runbook.steps.flatMap((step, index) => [
      `${index + 1}. ${step.command}`,
      `   Mode: ${step.mode}`,
      `   Validates: ${step.validates}`,
      `   Required env: ${formatList(step.requiredEnv)}`,
      `   Missing env: ${formatMissing(step.missingEnv)}`,
    ]),
  ].join("\n");
}

function createStep(input: {
  command: string;
  mode: MigrationReadinessStep["mode"];
  validates: string;
  requiredEnv: string[];
  env: MigrationReadinessEnv;
}): MigrationReadinessStep {
  return {
    command: input.command,
    mode: input.mode,
    validates: input.validates,
    requiredEnv: input.requiredEnv,
    missingEnv: input.requiredEnv.filter((key) => !input.env[key]),
  };
}
