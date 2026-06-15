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
  if (error === "source_document_already_exists") {
    const existingDocumentId =
      typeof record.documentId === "string" ? record.documentId : detail;
    return {
      message: "该来源文件已存在，请查看已有文档或更换来源渠道。",
      failedDocumentId: existingDocumentId,
    };
  }
  return {
    message: detail ?? error,
    failedDocumentId:
      typeof record.sourceDocumentId === "string" ? record.sourceDocumentId : null,
  };
}
