import { describe, expect, it } from "vitest";
import {
  classifyProviderFailure,
  formatProviderConnectivityFailure,
  formatProviderConnectivityResult,
} from "@/lib/smoke/provider-connectivity-diagnostics";
import type { ProviderConnectivitySmokeResult } from "@/lib/smoke/provider-connectivity";

describe("classifyProviderFailure", () => {
  it("classifies auth, timeout, dimension, and streaming failures", () => {
    expect(classifyProviderFailure("Request failed with status code 401")).toBe(
      "auth_failed",
    );
    expect(classifyProviderFailure("timeout of 60000ms exceeded")).toBe(
      "network_timeout",
    );
    expect(classifyProviderFailure("embedding_dimension_mismatch:2")).toBe(
      "embedding_shape_mismatch",
    );
    expect(classifyProviderFailure("deepseek_stream_missing_done")).toBe(
      "stream_incomplete",
    );
    expect(classifyProviderFailure("socket hang up")).toBe("unknown");
  });
});

describe("formatProviderConnectivityResult", () => {
  it("formats successful provider checks", () => {
    const result: ProviderConnectivitySmokeResult = {
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
    };

    expect(formatProviderConnectivityResult(result)).toContain(
      "Provider connectivity smoke passed",
    );
    expect(formatProviderConnectivityResult(result)).toContain(
      "SiliconFlow embedding: ok, model=BAAI/bge-large-zh-v1.5, dimension=1024",
    );
    expect(formatProviderConnectivityResult(result)).toContain(
      "DeepSeek chat: ok, model=deepseek-chat",
    );
  });

  it("formats actionable failure diagnostics", () => {
    const result: ProviderConnectivitySmokeResult = {
      ok: false,
      checks: [
        {
          name: "embedding",
          ok: false,
          provider: "SiliconFlow",
          model: "BAAI/bge-large-zh-v1.5",
          reason: "Request failed with status code 401",
        },
      ],
    };

    const text = formatProviderConnectivityFailure(result);

    expect(text).toContain("Provider connectivity smoke failed");
    expect(text).toContain("embedding: failed");
    expect(text).toContain("classification=auth_failed");
    expect(text).toContain("Check EMBEDDING_API_KEY");
  });
});
