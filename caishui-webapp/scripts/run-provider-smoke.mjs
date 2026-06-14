import { spawnPnpm } from "./pnpm-spawn.mjs";

const requiredEnv = [
  "EMBEDDING_API_KEY",
  "DEEPSEEK_API_KEY",
];

const missingEnv = requiredEnv.filter((key) => !process.env[key]);

if (missingEnv.length > 0) {
  console.error("Provider connectivity smoke runbook");
  console.error("Command: pnpm smoke:providers");
  console.error(`Required env: ${requiredEnv.join(", ")}`);
  console.error("RUN_PROVIDER_SMOKE is set automatically by this script.");
  console.error(`Missing env: ${missingEnv.join(", ")}`);
  console.error("What this validates:");
  console.error("- SiliconFlow embeddings return BAAI/bge-large-zh-v1.5 with 1024 dimensions");
  console.error("- DeepSeek chat streaming returns a valid SSE stream with [DONE]");
  console.error("What this does not validate:");
  console.error("- WebApp ↔ Pipeline ↔ DB live E2E; use pnpm smoke:e2e:live for that path");
  process.exit(1);
}

const child = spawnPnpm(
  ["vitest", "run", "lib/smoke/__tests__/provider-connectivity.live.test.ts"],
  {
    env: { ...process.env, RUN_PROVIDER_SMOKE: "true" },
    stdio: "inherit",
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`provider_connectivity_smoke_terminated:${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});
