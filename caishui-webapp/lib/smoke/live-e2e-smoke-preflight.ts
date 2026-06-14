import { isLiveE2ESmokeEnabled } from "@/lib/smoke/live-e2e-smoke-runner";
import { prisma } from "@/lib/db/client";
import { getErrorMessage } from "@/lib/utils/error";

type LiveSmokeEnv = Record<string, string | undefined>;

export interface LiveE2ESmokePreflightCheck {
  name: string;
  run(): Promise<{ ok: true } | { ok: false; reason: string }>;
}

export type LiveE2ESmokePreflightResult =
  | { ok: true }
  | {
      ok: false;
      reason: string;
      failures: Array<{ check: string; reason: string }>;
    };

export async function runLiveE2ESmokePreflight(input: {
  env?: LiveSmokeEnv;
  checks: LiveE2ESmokePreflightCheck[];
}): Promise<LiveE2ESmokePreflightResult> {
  const enabled = isLiveE2ESmokeEnabled(input.env);
  if (!enabled.enabled) {
    return {
      ok: false,
      reason: enabled.reason,
      failures: [{ check: "environment", reason: enabled.reason }],
    };
  }

  const failures: Array<{ check: string; reason: string }> = [];
  for (const check of input.checks) {
    const result = await check.run();
    if (!result.ok) {
      failures.push({ check: check.name, reason: result.reason });
    }
  }

  if (failures.length > 0) {
    return { ok: false, reason: "preflight_failed", failures };
  }
  return { ok: true };
}

export function createDefaultLiveE2ESmokePreflightChecks(input: {
  env?: LiveSmokeEnv;
  fetchImpl?: typeof fetch;
  dbPing?: () => Promise<void>;
} = {}): LiveE2ESmokePreflightCheck[] {
  const env = input.env ?? process.env;
  const fetchImpl = input.fetchImpl ?? fetch;
  const dbPing =
    input.dbPing ??
    (async () => {
      await prisma.$queryRaw`SELECT 1`;
    });

  return [
    {
      name: "pipeline_health",
      async run() {
        try {
          const baseUrl = env.DATA_PIPELINE_URL ?? "";
          const response = await fetchImpl(`${baseUrl.replace(/\/$/, "")}/health`, {
            method: "GET",
          });
          if (!response.ok) {
            return { ok: false, reason: `pipeline_health_${response.status}` };
          }
          return { ok: true };
        } catch (error) {
          return {
            ok: false,
            reason: `pipeline_health_unreachable:${getErrorMessage(error)}`,
          };
        }
      },
    },
    {
      name: "database",
      async run() {
        try {
          await dbPing();
          return { ok: true };
        } catch (error) {
          return {
            ok: false,
            reason: `database_unreachable:${getErrorMessage(error)}`,
          };
        }
      },
    },
  ];
}
