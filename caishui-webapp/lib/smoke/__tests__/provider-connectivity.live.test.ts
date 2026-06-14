import { describe, expect, it } from "vitest";
import {
  isProviderConnectivitySmokeEnabled,
  runProviderConnectivitySmoke,
} from "@/lib/smoke/provider-connectivity";
import { formatProviderConnectivityResult } from "@/lib/smoke/provider-connectivity-diagnostics";

const providerSmoke = isProviderConnectivitySmokeEnabled();
const describeProviderSmoke = providerSmoke.enabled ? describe : describe.skip;

describeProviderSmoke("Provider connectivity smoke", () => {
  it("validates SiliconFlow embeddings and DeepSeek chat streaming", async () => {
    const result = await runProviderConnectivitySmoke();

    if (!result.ok) {
      throw new Error(formatProviderConnectivityResult(result));
    }

    expect(result.checks).toHaveLength(2);
  }, 60_000);
});
