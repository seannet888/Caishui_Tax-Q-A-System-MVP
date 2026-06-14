import { describe, expect, it, vi } from "vitest";
import { waitForIngestCompletion } from "@/lib/pipeline/ingest-completion-readiness";

describe("waitForIngestCompletion", () => {
  it("polls until the accepted task reaches SUCCESS", async () => {
    const wait = vi.fn(async () => undefined);
    const getStatus = vi
      .fn()
      .mockResolvedValueOnce({
        status: 200,
        data: {
          task_id: "task-1",
          document_id: "doc-1",
          status: "PENDING",
        },
      })
      .mockResolvedValueOnce({
        status: 200,
        data: {
          task_id: "task-1",
          document_id: "doc-1",
          status: "SUCCESS",
        },
      });

    await expect(
      waitForIngestCompletion({
        actor: { id: "admin-1", roles: ["admin"] },
        accepted: { task_id: "task-1", document_id: "doc-1", status: "PENDING" },
        getStatus,
        wait,
        maxAttempts: 3,
      }),
    ).resolves.toEqual({
      ready: true,
      taskId: "task-1",
      documentId: "doc-1",
      taskStatus: "SUCCESS",
    });
    expect(wait).toHaveBeenCalledTimes(1);
  });

  it("returns task_failed when the pipeline task fails", async () => {
    await expect(
      waitForIngestCompletion({
        actor: { id: "admin-1", roles: ["admin"] },
        accepted: { task_id: "task-2", document_id: "doc-2", status: "PENDING" },
        getStatus: async () => ({
          status: 200,
          data: {
          task_id: "task-2",
          document_id: "doc-2",
          status: "FAILED",
          error_message: "embedding provider unavailable",
        },
      }),
        wait: async () => undefined,
      }),
    ).resolves.toEqual({
      ready: false,
      taskId: "task-2",
      documentId: "doc-2",
      reason: "task_failed",
      taskStatus: "FAILED",
      errorMessage: "embedding provider unavailable",
    });
  });

  it("returns task_timeout when the task never completes", async () => {
    await expect(
      waitForIngestCompletion({
        actor: { id: "admin-1", roles: ["admin"] },
        accepted: { task_id: "task-3", document_id: "doc-3", status: "PENDING" },
        getStatus: async () => ({
          status: 200,
          data: {
            task_id: "task-3",
            document_id: "doc-3",
            status: "PROCESSING",
          },
        }),
        wait: async () => undefined,
        maxAttempts: 2,
      }),
    ).resolves.toEqual({
      ready: false,
      taskId: "task-3",
      documentId: "doc-3",
      reason: "task_timeout",
      taskStatus: "PROCESSING",
    });
  });
});
