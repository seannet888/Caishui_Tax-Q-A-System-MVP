import {
  createEmbeddings,
  parseDeepSeekStream,
  streamChatCompletion,
} from "@/lib/knowledge/stream-handler";
import { getErrorMessage } from "@/lib/utils/error";

type ProviderSmokeEnv = Record<string, string | undefined>;

type ProviderSmokeEnabled =
  | { enabled: true }
  | { enabled: false; reason: string };

export type ProviderConnectivityCheckName = "embedding" | "chat";

export type ProviderConnectivityCheckResult =
  | {
      name: "embedding";
      ok: true;
      provider: "SiliconFlow";
      model: string;
      dimension: number;
    }
  | {
      name: "embedding";
      ok: false;
      provider: "SiliconFlow";
      model: string;
      reason: string;
    }
  | {
      name: "chat";
      ok: true;
      provider: "DeepSeek";
      model: "deepseek-chat";
      receivedText: string;
    }
  | {
      name: "chat";
      ok: false;
      provider: "DeepSeek";
      model: "deepseek-chat";
      reason: string;
    };

export interface ProviderConnectivitySmokeResult {
  ok: boolean;
  checks: ProviderConnectivityCheckResult[];
}

export interface ProviderConnectivitySmokeDependencies {
  createEmbeddings?: typeof createEmbeddings;
  streamChatCompletion?: typeof streamChatCompletion;
}

const REQUIRED_PROVIDER_ENV = [
  "EMBEDDING_API_KEY",
  "DEEPSEEK_API_KEY",
] as const;

const EXPECTED_EMBEDDING_DIMENSION = 1024;
const DEFAULT_EMBEDDING_MODEL = "BAAI/bge-large-zh-v1.5";

export function isProviderConnectivitySmokeEnabled(
  env: ProviderSmokeEnv = process.env,
): ProviderSmokeEnabled {
  if (env.RUN_PROVIDER_SMOKE !== "true") {
    return { enabled: false, reason: "RUN_PROVIDER_SMOKE_not_true" };
  }
  for (const key of REQUIRED_PROVIDER_ENV) {
    if (!env[key]) return { enabled: false, reason: `missing_env:${key}` };
  }
  return { enabled: true };
}

export async function runProviderConnectivitySmoke(
  dependencies: ProviderConnectivitySmokeDependencies = {},
): Promise<ProviderConnectivitySmokeResult> {
  const deps = {
    createEmbeddings,
    streamChatCompletion,
    ...dependencies,
  };

  const checks: ProviderConnectivityCheckResult[] = [];
  const embedding = await checkEmbeddingProvider(deps.createEmbeddings);
  checks.push(embedding);
  if (!embedding.ok) return { ok: false, checks };

  const chat = await checkDeepSeekProvider(deps.streamChatCompletion);
  checks.push(chat);

  return {
    ok: checks.every((check) => check.ok),
    checks,
  };
}

async function checkEmbeddingProvider(
  embed: typeof createEmbeddings,
): Promise<ProviderConnectivityCheckResult> {
  const model = process.env.EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODEL;
  try {
    const raw = (await embed(["provider connectivity smoke"])) as unknown;
    const embedding = readEmbedding(raw);
    if (!embedding) {
      return {
        name: "embedding",
        ok: false,
        provider: "SiliconFlow",
        model,
        reason: "embedding_missing",
      };
    }
    if (embedding.length !== EXPECTED_EMBEDDING_DIMENSION) {
      return {
        name: "embedding",
        ok: false,
        provider: "SiliconFlow",
        model,
        reason: `embedding_dimension_mismatch:${embedding.length}`,
      };
    }
    return {
      name: "embedding",
      ok: true,
      provider: "SiliconFlow",
      model,
      dimension: embedding.length,
    };
  } catch (error) {
    return {
      name: "embedding",
      ok: false,
      provider: "SiliconFlow",
      model,
      reason: getErrorMessage(error),
    };
  }
}

async function checkDeepSeekProvider(
  complete: typeof streamChatCompletion,
): Promise<ProviderConnectivityCheckResult> {
  try {
    const stream = await complete([
      { role: "system", content: "Reply with OK only." },
      { role: "user", content: "provider connectivity smoke" },
    ]);
    const receivedText = await collectDeepSeekStreamText(stream);
    return {
      name: "chat",
      ok: true,
      provider: "DeepSeek",
      model: "deepseek-chat",
      receivedText,
    };
  } catch (error) {
    return {
      name: "chat",
      ok: false,
      provider: "DeepSeek",
      model: "deepseek-chat",
      reason: getErrorMessage(error),
    };
  }
}

async function collectDeepSeekStreamText(
  stream: AsyncIterable<string | Uint8Array>,
): Promise<string> {
  const iterator = parseDeepSeekStream(stream);
  let text = "";
  while (true) {
    const next = await iterator.next();
    if (next.done) {
      if (next.value !== "upstream_done") {
        throw new Error("deepseek_stream_missing_done");
      }
      return text;
    }
    text += next.value;
  }
}

function readEmbedding(raw: unknown): number[] | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const data = (raw as { data?: unknown }).data;
  if (!Array.isArray(data)) return undefined;
  const first = data[0];
  if (!first || typeof first !== "object") return undefined;
  const embedding = (first as { embedding?: unknown }).embedding;
  return Array.isArray(embedding) && embedding.every((item) => typeof item === "number")
    ? embedding
    : undefined;
}
