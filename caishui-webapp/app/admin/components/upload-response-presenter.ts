export interface UploadFailureView {
  message: string;
  failedDocumentId: string | null;
}

export function presentUploadFailure(payload: unknown): UploadFailureView {
  if (!payload || typeof payload !== "object") {
    return { message: "upload_failed", failedDocumentId: null };
  }
  const record = payload as Record<string, unknown>;
  const detail = typeof record.detail === "string" ? record.detail : null;
  const error = typeof record.error === "string" ? record.error : "upload_failed";
  return {
    message: detail ?? error,
    failedDocumentId:
      typeof record.sourceDocumentId === "string" ? record.sourceDocumentId : null,
  };
}
