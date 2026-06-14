import net from "node:net";
import { spawnPnpm } from "./pnpm-spawn.mjs";

const requiredEnv = [
  "DATABASE_URL",
  "DATA_PIPELINE_URL",
  "PIPELINE_SHARED_SECRET",
];

const missingEnv = requiredEnv.filter((key) => !process.env[key]);

if (missingEnv.length > 0) {
  console.error("Live E2E smoke runbook");
  console.error("Command: pnpm smoke:e2e:live");
  console.error(`Required env: ${requiredEnv.join(", ")}`);
  console.error(`Missing env: ${missingEnv.join(", ")}`);
  console.error("Prerequisites:");
  console.error("- data-pipeline /health is reachable");
  console.error("- WebApp DATABASE_URL points at the migrated Postgres database");
  console.error("- PIPELINE_SHARED_SECRET matches data-pipeline");
  process.exit(1);
}

const pipelineHealth = await checkPipelineHealth(process.env.DATA_PIPELINE_URL);
if (!pipelineHealth.ok) {
  console.error("Live E2E smoke preflight failed");
  console.error("Command: pnpm smoke:e2e:live");
  console.error(`pipeline /health unreachable: ${pipelineHealth.reason}`);
  console.error("Action: start data-pipeline and verify DATA_PIPELINE_URL.");
  process.exit(1);
}

const databaseTarget = parseDatabaseTarget(process.env.DATABASE_URL);
if (!databaseTarget.ok) {
  console.error("Live E2E smoke preflight failed");
  console.error("Command: pnpm smoke:e2e:live");
  console.error("DATABASE_URL is not a valid URL");
  console.error(`Reason: ${databaseTarget.reason}`);
  process.exit(1);
}

const databaseReachable = await canReachTcp(databaseTarget.host, databaseTarget.port);
if (!databaseReachable) {
  console.error("Live E2E smoke preflight failed");
  console.error("Command: pnpm smoke:e2e:live");
  console.error(`DATABASE_URL host unreachable: ${databaseTarget.host}:${databaseTarget.port}`);
  console.error("Action: start the local Postgres/pgvector service or update DATABASE_URL.");
  process.exit(1);
}

const child = spawnPnpm(
  ["vitest", "run", "lib/smoke/__tests__/live-e2e-smoke.test.ts"],
  {
    env: { ...process.env, RUN_E2E_SMOKE: "true" },
    stdio: "inherit",
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`live_e2e_smoke_terminated:${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});

async function checkPipelineHealth(baseUrl) {
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/health`);
    if (!response.ok) return { ok: false, reason: `status_${response.status}` };
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

function parseDatabaseTarget(databaseUrl) {
  try {
    const url = new URL(databaseUrl);
    return {
      ok: true,
      host: url.hostname,
      port: Number(url.port || "5432"),
    };
  } catch (error) {
    return { ok: false, reason: String(error) };
  }
}

function canReachTcp(host, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const finish = (ok) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(1500);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, host);
  });
}
