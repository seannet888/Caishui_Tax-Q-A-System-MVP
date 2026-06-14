export interface PipelineTaskStatus {
  status: "PENDING" | "PROCESSING" | "SUCCESS" | "FAILED";
  completed_chunks: number;
  total_chunks: number;
  error_message?: string | null;
}

export type PipelineStatusView =
  | { kind: "task"; status: PipelineTaskStatus }
  | { kind: "error"; message: string };

export function presentPipelineStatusPayload(payload: unknown): PipelineStatusView {
  if (isPipelineTaskStatus(payload)) return { kind: "task", status: payload };
  if (isErrorPayload(payload)) {
    return {
      kind: "error",
      message: payload.detail || payload.error,
    };
  }
  return { kind: "error", message: "无法读取清洗任务状态" };
}

function isPipelineTaskStatus(payload: unknown): payload is PipelineTaskStatus {
  if (!payload || typeof payload !== "object") return false;
  const record = payload as Record<string, unknown>;
  return (
    typeof record.status === "string" &&
    ["PENDING", "PROCESSING", "SUCCESS", "FAILED"].includes(record.status) &&
    typeof record.completed_chunks === "number" &&
    typeof record.total_chunks === "number"
  );
}

function isErrorPayload(payload: unknown): payload is {
  error: string;
  detail?: string;
} {
  if (!payload || typeof payload !== "object") return false;
  const record = payload as Record<string, unknown>;
  return (
    typeof record.error === "string" &&
    (record.detail === undefined || typeof record.detail === "string")
  );
}
