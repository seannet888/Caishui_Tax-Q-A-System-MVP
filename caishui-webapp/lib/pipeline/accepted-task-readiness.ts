import type { Actor } from "@/lib/auth/actor";
import type { PipelineIngestAccepted } from "@/lib/pipeline/ingest-client";
import { getPipelineStatus } from "@/lib/pipeline/status-client";

type PipelineTaskStatus = "PENDING" | "PROCESSING" | "SUCCESS" | "FAILED";

interface StatusResponse {
  status: number;
  data: unknown;
}

interface AcceptedTaskReadinessInput {
  actor: Actor;
  accepted: PipelineIngestAccepted;
  getStatus?: (input: { actor: Actor; taskId: string }) => Promise<StatusResponse>;
}

export type AcceptedTaskReadiness =
  | {
      ready: true;
      taskId: string;
      documentId: string;
      taskStatus: PipelineTaskStatus;
      errorMessage?: string;
    }
  | {
      ready: false;
      taskId: string;
      documentId: string;
      reason:
        | "task_not_found"
        | "status_request_failed"
        | "task_identity_mismatch"
        | "unexpected_status_payload";
      httpStatus?: number;
    };

export async function checkAcceptedTaskReadiness(
  input: AcceptedTaskReadinessInput,
): Promise<AcceptedTaskReadiness> {
  const getStatus = input.getStatus ?? getPipelineStatus;
  const response = await getStatus({
    actor: input.actor,
    taskId: input.accepted.task_id,
  });

  if (response.status === 404) {
    return notReady(input.accepted, "task_not_found", response.status);
  }
  if (response.status < 200 || response.status >= 300) {
    return notReady(input.accepted, "status_request_failed", response.status);
  }
  if (!isStatusPayload(response.data)) {
    return notReady(input.accepted, "unexpected_status_payload", response.status);
  }
  if (
    response.data.task_id !== input.accepted.task_id ||
    response.data.document_id !== input.accepted.document_id
  ) {
    return notReady(input.accepted, "task_identity_mismatch", response.status);
  }

  return {
    ready: true,
    taskId: response.data.task_id,
    documentId: response.data.document_id,
    taskStatus: response.data.status,
    errorMessage: response.data.error_message,
  };
}

function notReady(
  accepted: PipelineIngestAccepted,
  reason: Exclude<AcceptedTaskReadiness, { ready: true }>["reason"],
  httpStatus?: number,
): AcceptedTaskReadiness {
  return {
    ready: false,
    taskId: accepted.task_id,
    documentId: accepted.document_id,
    reason,
    httpStatus,
  };
}

function isStatusPayload(value: unknown): value is {
  task_id: string;
  document_id: string;
  status: PipelineTaskStatus;
  error_message?: string;
} {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.task_id === "string" &&
    typeof record.document_id === "string" &&
    isPipelineTaskStatus(record.status) &&
    (record.error_message === undefined ||
      record.error_message === null ||
      typeof record.error_message === "string")
  );
}

function isPipelineTaskStatus(value: unknown): value is PipelineTaskStatus {
  return (
    value === "PENDING" ||
    value === "PROCESSING" ||
    value === "SUCCESS" ||
    value === "FAILED"
  );
}
