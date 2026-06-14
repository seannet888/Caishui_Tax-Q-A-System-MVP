import { isProviderConnectivitySmokeEnabled } from "@/lib/smoke/provider-connectivity";

type ProviderSmokeEnv = Record<string, string | undefined>;

const REQUIRED_ENV = [
  "RUN_PROVIDER_SMOKE",
  "EMBEDDING_API_KEY",
  "DEEPSEEK_API_KEY",
] as const;

export function getProviderConnectivityRunbook(
  env: ProviderSmokeEnv = process.env,
): string {
  const enabled = isProviderConnectivitySmokeEnabled(env);
  const missingEnv = REQUIRED_ENV.filter((key) =>
    key === "RUN_PROVIDER_SMOKE" ? env[key] !== "true" : !env[key],
  );

  return [
    "Provider connectivity smoke runbook",
    "Command: pnpm smoke:providers",
    `Required env: ${REQUIRED_ENV.join(", ")}`,
    enabled.enabled ? "Status: ready" : `Status: disabled:${enabled.reason}`,
    missingEnv.length ? `Missing env: ${missingEnv.join(", ")}` : "Missing env: none",
    "What this validates:",
    "- SiliconFlow embeddings return BAAI/bge-large-zh-v1.5 with 1024 dimensions",
    "- DeepSeek chat streaming returns a valid SSE stream with [DONE]",
    "What this does not validate:",
    "- WebApp ↔ Pipeline ↔ DB live E2E; use pnpm smoke:e2e:live for that path",
  ].join("\n");
}
