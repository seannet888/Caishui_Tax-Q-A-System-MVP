import type { Actor } from "@/lib/auth/actor";
import type { PipelineIngestAccepted } from "@/lib/pipeline/ingest-client";
import {
  checkAcceptedTaskReadiness,
  type AcceptedTaskReadiness,
} from "@/lib/pipeline/accepted-task-readiness";

type PipelineTaskStatus = "PENDING" | "PROCESSING" | "SUCCESS" | "FAILED";

interface StatusResponse {
  status: number;
  data: unknown;
}

interface IngestCompletionInput {
  actor: Actor;
  accepted: PipelineIngestAccepted;
  getStatus?: (input: { actor: Actor; taskId: string }) => Promise<StatusResponse>;
  wait?: (ms: number) => Promise<void>;
  maxAttempts?: number;
  intervalMs?: number;
}

export type IngestCompletionReadiness =
  | {
      ready: true;
      taskId: string;
      documentId: string;
      taskStatus: "SUCCESS";
    }
  | {
      ready: false;
      taskId: string;
      documentId: string;
      reason:
        | Exclude<AcceptedTaskReadiness, { ready: true }>["reason"]
        | "task_failed"
        | "task_timeout";
      taskStatus?: PipelineTaskStatus;
      errorMessage?: string;
      httpStatus?: number;
    };

const DEFAULT_MAX_ATTEMPTS = 30;
const DEFAULT_INTERVAL_MS = 1_000;

export async function waitForIngestCompletion(
  input: IngestCompletionInput,
): Promise<IngestCompletionReadiness> {
  const wait = input.wait ?? sleep;
  const maxAttempts = input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const intervalMs = input.intervalMs ?? DEFAULT_INTERVAL_MS;
  let lastStatus: PipelineTaskStatus | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const readiness = await checkAcceptedTaskReadiness({
      actor: input.actor,
      accepted: input.accepted,
      getStatus: input.getStatus,
    });
    if (!readiness.ready) return readiness;

    lastStatus = readiness.taskStatus;
    if (readiness.taskStatus === "SUCCESS") {
      return {
        ready: true,
        taskId: readiness.taskId,
        documentId: readiness.documentId,
        taskStatus: "SUCCESS",
      };
    }
    if (readiness.taskStatus === "FAILED") {
      return {
        ready: false,
        taskId: readiness.taskId,
        documentId: readiness.documentId,
        reason: "task_failed",
        taskStatus: "FAILED",
        errorMessage: readiness.errorMessage,
      };
    }
    if (attempt < maxAttempts) await wait(intervalMs);
  }

  return {
    ready: false,
    taskId: input.accepted.task_id,
    documentId: input.accepted.document_id,
    reason: "task_timeout",
    taskStatus: lastStatus,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
