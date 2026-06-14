import { beforeEach, describe, expect, it, vi } from "vitest";

const { signPipelineRequest } = vi.hoisted(() => ({
  signPipelineRequest: vi.fn(() => ({ "X-Signed": "yes" })),
}));

vi.mock("@/lib/pipeline/trust-adapter", () => ({
  signPipelineRequest,
}));

import { getPipelineStatus } from "@/lib/pipeline/status-client";

describe("getPipelineStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATA_PIPELINE_URL = "http://pipeline.test";
  });

  it("向 data-pipeline /status/{taskId} 发起 signed GET 并透传响应", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json(
        { task_id: "task-1", status: "PROCESSING", progress: 0.5 },
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getPipelineStatus({
      actor: { id: "viewer-1", roles: ["viewer"] },
      taskId: "task-1",
    });

    expect(fetchMock).toHaveBeenCalledWith("http://pipeline.test/status/task-1", {
      headers: { "X-Signed": "yes" },
    });
    expect(signPipelineRequest).toHaveBeenCalledWith({
      method: "GET",
      path: "/status/task-1",
      actor: { id: "viewer-1", roles: ["viewer"] },
    });
    expect(result).toEqual({
      data: { task_id: "task-1", status: "PROCESSING", progress: 0.5 },
      status: 200,
    });
  });

  it("透传非 JSON pipeline 错误，避免遮蔽 status 失败原因", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Internal Server Error", { status: 500 })),
    );

    const result = await getPipelineStatus({
      actor: { id: "viewer-1", roles: ["viewer"] },
      taskId: "task-1",
    });

    expect(result).toEqual({
      data: "Internal Server Error",
      status: 500,
    });
  });

  it("pipeline 网络不可达时透传 transport error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );

    const result = await getPipelineStatus({
      actor: { id: "viewer-1", roles: ["viewer"] },
      taskId: "task-1",
    });

    expect(result).toEqual({
      data: "network_error:fetch failed",
      status: 0,
    });
  });
});
