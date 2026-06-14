import net from "node:net";
import { spawnPnpm } from "./pnpm-spawn.mjs";

if (!process.env.DATABASE_URL) {
  console.error("Release readiness runbook");
  console.error("Command: pnpm release:readiness");
  console.error("Required env: DATABASE_URL");
  console.error("Missing env: DATABASE_URL");
  console.error("What this validates:");
  console.error("- no chunks with verification_method='auto'");
  console.error("- no chunks with verification_status='disputed'");
  console.error("- failed answers have failed_at, error_code, and error_message");
  process.exit(1);
}

const databaseTarget = parseDatabaseTarget(process.env.DATABASE_URL);
if (!databaseTarget.ok) {
  console.error("Release readiness database preflight failed");
  console.error("Command: pnpm release:readiness");
  console.error("DATABASE_URL is not a valid URL");
  console.error(`Reason: ${databaseTarget.reason}`);
  process.exit(1);
}

const reachable = await canReachTcp(databaseTarget.host, databaseTarget.port);
if (!reachable) {
  console.error("Release readiness database preflight failed");
  console.error("Command: pnpm release:readiness");
  console.error(`DATABASE_URL host: ${databaseTarget.host}:${databaseTarget.port}`);
  console.error("Action: start the local Postgres/pgvector service or update DATABASE_URL.");
  process.exit(1);
}

const child = spawnPnpm(
  ["vitest", "run", "lib/knowledge/__tests__/release-readiness.live.test.ts"],
  {
    env: { ...process.env, RUN_RELEASE_READINESS: "true" },
    stdio: "inherit",
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`release_readiness_terminated:${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});

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
