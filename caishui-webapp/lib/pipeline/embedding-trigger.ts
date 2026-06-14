// WebApp -> data-pipeline trigger for single verified chunk embedding.

import type { Actor } from "@/lib/auth/actor";
import { requestPipeline } from "@/lib/pipeline/http-client";
import { formatPipelineError } from "@/lib/pipeline/response";

export interface ChunkEmbeddingTriggerResult {
  ok: boolean;
  status: "QUEUED" | "FAILED";
  error?: string;
}

export async function triggerChunkEmbedding(
  chunkId: string,
  actor: Actor,
): Promise<ChunkEmbeddingTriggerResult> {
  const path = `/chunks/${encodeURIComponent(chunkId)}/embed`;
  try {
    const response = await requestPipeline({
      actor,
      method: "POST",
      path,
    });
    if (!response.ok) {
      return {
        ok: false,
        status: "FAILED",
        error: `pipeline_embedding_rejected:${response.status}:${formatPipelineError(response.data)}`,
      };
    }
    return { ok: true, status: "QUEUED" };
  } catch (error) {
    return { ok: false, status: "FAILED", error: String(error) };
  }
}
