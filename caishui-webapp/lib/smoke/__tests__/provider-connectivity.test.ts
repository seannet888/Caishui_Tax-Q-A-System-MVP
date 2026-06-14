import { describe, expect, it } from "vitest";
import {
  isProviderConnectivitySmokeEnabled,
  runProviderConnectivitySmoke,
} from "@/lib/smoke/provider-connectivity";

describe("isProviderConnectivitySmokeEnabled", () => {
  it("requires explicit opt-in and provider credentials", () => {
    expect(
      isProviderConnectivitySmokeEnabled({
        RUN_PROVIDER_SMOKE: "true",
        EMBEDDING_API_KEY: "embedding-key",
        DEEPSEEK_API_KEY: "deepseek-key",
      }),
    ).toEqual({ enabled: true });

    expect(
      isProviderConnectivitySmokeEnabled({
        EMBEDDING_API_KEY: "embedding-key",
        DEEPSEEK_API_KEY: "deepseek-key",
      }),
    ).toEqual({ enabled: false, reason: "RUN_PROVIDER_SMOKE_not_true" });

    expect(
      isProviderConnectivitySmokeEnabled({
        RUN_PROVIDER_SMOKE: "true",
        DEEPSEEK_API_KEY: "deepseek-key",
      }),
    ).toEqual({ enabled: false, reason: "missing_env:EMBEDDING_API_KEY" });
  });
});

describe("runProviderConnectivitySmoke", () => {
  it("passes when embedding returns 1024 dimensions and DeepSeek stream completes", async () => {
    const result = await runProviderConnectivitySmoke({
      createEmbeddings: async () => ({
        data: [{ embedding: Array.from({ length: 1024 }, () => 0.1) }],
      }),
      streamChatCompletion: async () =>
        asyncIterable([
          'data: {"choices":[{"delta":{"content":"OK"}}]}\n\n',
          "data: [DONE]\n\n",
        ]),
    });

    expect(result).toEqual({
      ok: true,
      checks: [
        {
          name: "embedding",
          ok: true,
          provider: "SiliconFlow",
          model: "BAAI/bge-large-zh-v1.5",
          dimension: 1024,
        },
        {
          name: "chat",
          ok: true,
          provider: "DeepSeek",
          model: "deepseek-chat",
          receivedText: "OK",
        },
      ],
    });
  });

  it("reports embedding format failures without running the chat check", async () => {
    const result = await runProviderConnectivitySmoke({
      createEmbeddings: async () => ({
        data: [{ embedding: [0.1, 0.2] }],
      }),
      streamChatCompletion: async () => {
        throw new Error("chat_should_not_run");
      },
    });

    expect(result).toEqual({
      ok: false,
      checks: [
        {
          name: "embedding",
          ok: false,
          provider: "SiliconFlow",
          model: "BAAI/bge-large-zh-v1.5",
          reason: "embedding_dimension_mismatch:2",
        },
      ],
    });
  });

  it("reports DeepSeek stream failures after embedding passes", async () => {
    const result = await runProviderConnectivitySmoke({
      createEmbeddings: async () => ({
        data: [{ embedding: Array.from({ length: 1024 }, () => 0.1) }],
      }),
      streamChatCompletion: async () =>
        asyncIterable(['data: {"choices":[{"delta":{"content":"OK"}}]}\n\n']),
    });

    expect(result.ok).toBe(false);
    expect(result.checks[0]).toMatchObject({ name: "embedding", ok: true });
    expect(result.checks[1]).toMatchObject({
      name: "chat",
      ok: false,
      provider: "DeepSeek",
      model: "deepseek-chat",
      reason: "deepseek_stream_missing_done",
    });
  });
});

async function* asyncIterable(chunks: string[]): AsyncGenerator<string> {
  for (const chunk of chunks) yield chunk;
}
