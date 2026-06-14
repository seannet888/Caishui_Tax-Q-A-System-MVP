import { beforeEach, describe, expect, it, vi } from "vitest";

const { getPipelineStatus } = vi.hoisted(() => ({
  getPipelineStatus: vi.fn(),
}));

vi.mock("@/lib/auth/actor", () => ({
  resolveActor: () => ({ id: "viewer-1", roles: ["viewer"] }),
}));

vi.mock("@/lib/pipeline/status-client", () => ({
  getPipelineStatus,
}));

import { GET } from "@/app/api/pipeline/status/route";

describe("GET /api/pipeline/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps pipeline transport status 0 to HTTP 502 with diagnostic body", async () => {
    getPipelineStatus.mockResolvedValueOnce({
      status: 0,
      data: "network_error:fetch failed",
    });

    const response = await GET(
      new Request("http://localhost/api/pipeline/status?taskId=task-1") as never,
    );

    await expect(response.json()).resolves.toEqual({
      error: "pipeline_unavailable",
      detail: "network_error:fetch failed",
    });
    expect(response.status).toBe(502);
    expect(getPipelineStatus).toHaveBeenCalledWith({
      actor: { id: "viewer-1", roles: ["viewer"] },
      taskId: "task-1",
    });
  });

  it("passes through normal pipeline task status responses", async () => {
    getPipelineStatus.mockResolvedValueOnce({
      status: 200,
      data: {
        task_id: "task-1",
        status: "PROCESSING",
        completed_chunks: 1,
        total_chunks: 3,
      },
    });

    const response = await GET(
      new Request("http://localhost/api/pipeline/status?taskId=task-1") as never,
    );

    await expect(response.json()).resolves.toEqual({
      task_id: "task-1",
      status: "PROCESSING",
      completed_chunks: 1,
      total_chunks: 3,
    });
    expect(response.status).toBe(200);
  });
});
