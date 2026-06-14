import { beforeEach, describe, expect, it, vi } from "vitest";

const { signPipelineRequest } = vi.hoisted(() => ({
  signPipelineRequest: vi.fn(() => ({ "X-Signed": "yes" })),
}));

vi.mock("@/lib/pipeline/trust-adapter", () => ({
  signPipelineRequest,
}));

import { requestPipeline } from "@/lib/pipeline/http-client";

describe("requestPipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATA_PIPELINE_URL = "http://pipeline.test";
  });

  it("sends a signed pipeline request and preserves plain-text errors", async () => {
    const fetchMock = vi.fn(
      async () => new Response("Internal Server Error", { status: 500 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await requestPipeline({
      actor: { id: "admin-1", roles: ["admin"] },
      method: "POST",
      path: "/preview",
      body: new FormData(),
    });

    expect(fetchMock).toHaveBeenCalledWith("http://pipeline.test/preview", {
      method: "POST",
      headers: { "X-Signed": "yes" },
      body: expect.any(FormData),
    });
    expect(signPipelineRequest).toHaveBeenCalledWith({
      method: "POST",
      path: "/preview",
      actor: { id: "admin-1", roles: ["admin"] },
    });
    expect(response).toEqual({
      ok: false,
      status: 500,
      data: "Internal Server Error",
    });
  });

  it("classifies network failures without leaking raw fetch exceptions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );

    const response = await requestPipeline({
      actor: { id: "admin-1", roles: ["admin"] },
      method: "POST",
      path: "/ingest",
      body: new FormData(),
    });

    expect(response).toEqual({
      ok: false,
      status: 0,
      data: "network_error:fetch failed",
    });
  });
});
