// lib/knowledge/stream-handler.ts
// DeepSeek 调用 + 流式响应处理 + 队列平滑。
// ⚠️ 流式 Chat 禁止自动重放（避免重复生成/计费/审计歧义）；仅非流式可重放请求（如 Embedding）使用 retry client。

import axios from "axios";
import axiosRetry from "axios-retry";
import PQueue from "p-queue";

const deepseekClient = axios.create({
  baseURL: "https://api.deepseek.com/v1",
  timeout: 60000,
  headers: { Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` },
});

// Embedding 走独立提供商：硅基流动(SiliconFlow) + BAAI/bge-large-zh-v1.5（1024维），见 ADR-0006。
// 与 DeepSeek 是两套 base_url / key / model；非流式、可安全重放，故挂 retry。
const embeddingClient = axios.create({
  baseURL: process.env.EMBEDDING_BASE_URL ?? "https://api.siliconflow.cn/v1",
  timeout: 60000,
  headers: { Authorization: `Bearer ${process.env.EMBEDDING_API_KEY}` },
});

// 指数退避重试：1s → 2s → 4s
axiosRetry(embeddingClient, {
  retries: 3,
  retryDelay: (retryCount) => Math.pow(2, retryCount - 1) * 1000,
  retryCondition: (error) =>
    axiosRetry.isNetworkOrIdempotentRequestError(error) ||
    [429, 502, 503].includes(error.response?.status ?? 0),
  onRetry: (retryCount, error) => {
    console.warn(`Embedding API 第 ${retryCount} 次重试，原因：${error.message}`);
  },
});

const configuredRpm = Number(process.env.DEEPSEEK_RPM ?? 60);

// concurrency 控制同时运行数；intervalCap/interval 控制每分钟启动数。
// 生产配置必须同时考虑 RPM 与 TPM；此处只约束请求数。
const apiQueue = new PQueue({
  concurrency: Number(process.env.DEEPSEEK_MAX_CONCURRENCY ?? 10),
  intervalCap: configuredRpm,
  interval: 60_000,
});

export function getQueueSize(): number {
  return apiQueue.size;
}

/** 非流式 Embedding（可重试）。硅基流动 BAAI/bge-large-zh-v1.5，1024维。 */
export async function createEmbeddings(inputs: string[]) {
  const response = await embeddingClient.post("/embeddings", {
    model: process.env.EMBEDDING_MODEL ?? "BAAI/bge-large-zh-v1.5",
    input: inputs,
  });
  return response.data;
}

/** 流式 Chat（禁止自动重放）。返回 Node stream。 */
export async function streamChatCompletion(
  messages: Array<{ role: string; content: string }>,
  signal?: AbortSignal,
) {
  const response = await deepseekClient.post(
    "/chat/completions",
    { model: "deepseek-chat", messages, stream: true },
    { responseType: "stream", signal },
  );
  return response.data;
}

/** 高并发时经队列平滑启动流式请求。 */
export async function streamChatWithQueue(
  messages: Array<{ role: string; content: string }>,
  signal?: AbortSignal,
) {
  return apiQueue.add(() => streamChatCompletion(messages, signal));
}

type DeepSeekStreamChunk = string | Uint8Array;

function parseSseEvent(event: string): { done: boolean; delta?: string } {
  const data = event
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");
  if (!data) return { done: false };
  if (data === "[DONE]") return { done: true };

  const payload = JSON.parse(data) as {
    choices?: Array<{ delta?: { content?: unknown } }>;
  };
  const content = payload.choices?.[0]?.delta?.content;
  return {
    done: false,
    delta: typeof content === "string" && content ? content : undefined,
  };
}

/** 将 DeepSeek 的 SSE Node stream 转成文本 delta，处理跨网络块拆行。 */
export async function* parseDeepSeekStream(
  source: AsyncIterable<DeepSeekStreamChunk>,
): AsyncGenerator<string, "upstream_done"> {
  const decoder = new TextDecoder();
  let buffer = "";

  for await (const chunk of source) {
    buffer +=
      typeof chunk === "string"
        ? chunk
        : decoder.decode(chunk, { stream: true });

    let separator = buffer.search(/\r?\n\r?\n/);
    while (separator >= 0) {
      const event = buffer.slice(0, separator);
      const separatorMatch = buffer.slice(separator).match(/^\r?\n\r?\n/);
      buffer = buffer.slice(separator + (separatorMatch?.[0].length ?? 2));

      const parsed = parseSseEvent(event);
      if (parsed.done) return "upstream_done";
      if (parsed.delta) yield parsed.delta;
      separator = buffer.search(/\r?\n\r?\n/);
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    const parsed = parseSseEvent(buffer);
    if (parsed.done) return "upstream_done";
    if (parsed.delta) yield parsed.delta;
  }
  throw new Error("deepseek_stream_missing_done");
}
