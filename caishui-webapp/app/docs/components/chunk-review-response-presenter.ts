export interface ChunkReviewView {
  ok: boolean;
  message: string | null;
}

export function presentChunkReviewResponse(payload: unknown): ChunkReviewView {
  if (!payload || typeof payload !== "object") {
    return { ok: false, message: "chunk_review_failed" };
  }
  const record = payload as Record<string, unknown>;
  if (typeof record.error === "string") {
    return { ok: false, message: record.error };
  }
  const embedding = record.embedding;
  if (embedding && typeof embedding === "object") {
    const embeddingRecord = embedding as Record<string, unknown>;
    if (embeddingRecord.ok === false) {
      return {
        ok: true,
        message:
          typeof embeddingRecord.error === "string"
            ? `核验已保存，但向量化任务未启动：${embeddingRecord.error}`
            : "核验已保存，但向量化任务未启动",
      };
    }
  }
  return { ok: true, message: null };
}
