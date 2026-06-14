import { z } from "zod";
import type { Actor } from "@/lib/auth/actor";
import { requestPipeline } from "@/lib/pipeline/http-client";
import { formatPipelineError } from "@/lib/pipeline/response";
import type { DocType, PipelineOutput } from "@/types/pipeline";

const pipelineOutputSchema = z.object({
  task_id: z.string(),
  document_id: z.string(),
  status: z.enum(["success", "partial_failure", "failed"]),
  chunks: z.array(z.unknown()),
  total_chunks: z.number(),
  processing_time_ms: z.number(),
  errors: z.array(z.string()),
  created_at: z.string(),
});

export async function startPipelinePreview(input: {
  actor: Actor;
  fileName: string;
  bytes: Buffer;
  title?: string;
  sourceChannel?: string;
  issuingBody?: string;
  jurisdiction?: string;
  docType?: DocType;
}): Promise<PipelineOutput> {
  const path = "/preview";
  const body = new FormData();
  body.append("file", new Blob([input.bytes]), input.fileName);
  appendOptional(body, "title", input.title);
  appendOptional(body, "source_channel", input.sourceChannel);
  appendOptional(body, "issuing_body", input.issuingBody);
  appendOptional(body, "jurisdiction", input.jurisdiction);
  appendOptional(body, "doc_type", input.docType);

  const response = await requestPipeline({
    actor: input.actor,
    method: "POST",
    path,
    body,
  });
  if (!response.ok) {
    throw new Error(
      `pipeline_preview_rejected:${response.status}:${formatPipelineError(response.data)}`,
    );
  }
  return pipelineOutputSchema.parse(response.data) as PipelineOutput;
}

function appendOptional(body: FormData, key: string, value: string | undefined) {
  if (value) body.append(key, value);
}
