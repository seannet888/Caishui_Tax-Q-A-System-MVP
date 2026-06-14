import { describe, expect, it } from "vitest";
import { signPipelineRequest } from "@/lib/pipeline/trust-adapter";

describe("signPipelineRequest", () => {
  it("生成与 Pipeline verifier 一致的短时效身份签名", () => {
    const headers = signPipelineRequest({
      method: "POST",
      path: "/ingest",
      actor: { id: "admin-1", roles: ["reviewer", "admin"] },
      timestamp: 1_710_000_000,
      secret: "shared-secret",
    });

    expect(headers).toEqual({
      "X-Pipeline-Auth-Version": "v1",
      "X-Pipeline-Timestamp": "1710000000",
      "X-Pipeline-Actor-ID": "admin-1",
      "X-Pipeline-Actor-Roles": "admin,reviewer",
      "X-Pipeline-Signature":
        "14481130e71ff1111c9720ed707e6c0facf919356f702078a31668a7fa21e4e0",
    });
  });
});
