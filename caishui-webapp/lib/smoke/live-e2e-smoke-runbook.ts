type LiveSmokeEnv = Record<string, string | undefined>;

export const LIVE_E2E_SMOKE_REQUIRED_ENV = [
  "DATABASE_URL",
  "DATA_PIPELINE_URL",
  "PIPELINE_SHARED_SECRET",
] as const;

export interface LiveE2ESmokeRunbook {
  command: string;
  requiredEnv: string[];
  missingEnv: string[];
  prerequisites: string[];
}

export function getLiveE2ESmokeRunbook(
  env: LiveSmokeEnv = process.env,
): LiveE2ESmokeRunbook {
  return {
    command: "pnpm smoke:e2e:live",
    requiredEnv: [...LIVE_E2E_SMOKE_REQUIRED_ENV],
    missingEnv: LIVE_E2E_SMOKE_REQUIRED_ENV.filter((key) => !env[key]),
    prerequisites: [
      "data-pipeline /health is reachable",
      "WebApp DATABASE_URL points at the migrated Postgres database",
      "PIPELINE_SHARED_SECRET matches data-pipeline",
    ],
  };
}

export function formatLiveE2ESmokeRunbook(
  runbook: LiveE2ESmokeRunbook,
): string {
  const missing =
    runbook.missingEnv.length > 0
      ? runbook.missingEnv.join(", ")
      : "no missing environment variables";

  return [
    "Live E2E smoke runbook",
    `Command: ${runbook.command}`,
    `Required env: ${runbook.requiredEnv.join(", ")}`,
    `Missing env: ${missing}`,
    "Prerequisites:",
    ...runbook.prerequisites.map((item) => `- ${item}`),
  ].join("\n");
}
