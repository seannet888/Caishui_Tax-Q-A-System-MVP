import { describe, expect, it } from "vitest";
import { checkAcceptedTaskReadiness } from "@/lib/pipeline/accepted-task-readiness";

describe("checkAcceptedTaskReadiness", () => {
  it("returns ready when status endpoint exposes the accepted task identity", async () => {
    const result = await checkAcceptedTaskReadiness({
      actor: { id: "admin-1", roles: ["admin"] },
      accepted: {
        task_id: "00000000-0000-4000-8000-000000000001",
        document_id: "doc-1",
        status: "PENDING",
      },
      getStatus: async () => ({
        status: 200,
        data: {
          task_id: "00000000-0000-4000-8000-000000000001",
          document_id: "doc-1",
          status: "PROCESSING",
          completed_chunks: 0,
          total_chunks: 0,
          progress: 0,
        },
      }),
    });

    expect(result).toEqual({
      ready: true,
      taskId: "00000000-0000-4000-8000-000000000001",
      documentId: "doc-1",
      taskStatus: "PROCESSING",
    });
  });

  it("returns task_not_found when accepted task is not visible through status yet", async () => {
    const result = await checkAcceptedTaskReadiness({
      actor: { id: "admin-1", roles: ["admin"] },
      accepted: {
        task_id: "00000000-0000-4000-8000-000000000002",
        document_id: "doc-2",
        status: "PENDING",
      },
      getStatus: async () => ({
        status: 404,
        data: { detail: "task_not_found" },
      }),
    });

    expect(result).toEqual({
      ready: false,
      taskId: "00000000-0000-4000-8000-000000000002",
      documentId: "doc-2",
      reason: "task_not_found",
      httpStatus: 404,
    });
  });

  it("returns task_identity_mismatch when status exposes a different document", async () => {
    const result = await checkAcceptedTaskReadiness({
      actor: { id: "admin-1", roles: ["admin"] },
      accepted: {
        task_id: "00000000-0000-4000-8000-000000000003",
        document_id: "doc-3",
        status: "PENDING",
      },
      getStatus: async () => ({
        status: 200,
        data: {
          task_id: "00000000-0000-4000-8000-000000000003",
          document_id: "other-doc",
          status: "PENDING",
        },
      }),
    });

    expect(result).toEqual({
      ready: false,
      taskId: "00000000-0000-4000-8000-000000000003",
      documentId: "doc-3",
      reason: "task_identity_mismatch",
      httpStatus: 200,
    });
  });
});
