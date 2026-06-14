import { z } from "zod";
import type { Actor } from "@/lib/auth/actor";
import type { PipelineIngestPayload } from "@/lib/knowledge/source-ingestion";
import { requestPipeline } from "@/lib/pipeline/http-client";
import { formatPipelineError } from "@/lib/pipeline/response";

const pipelineAcceptedSchema = z.object({
  task_id: z.string().uuid(),
  document_id: z.string(),
  status: z.literal("PENDING"),
});

export type PipelineIngestAccepted = z.infer<typeof pipelineAcceptedSchema>;

export async function startPipelineIngest(input: {
  actor: Actor;
  payload: PipelineIngestPayload;
}): Promise<PipelineIngestAccepted> {
  const path = "/ingest";
  const body = new FormData();
  body.append("file", new Blob([input.payload.bytes]), input.payload.fileName);
  body.append("document_id", input.payload.documentId);
  body.append("file_hash", input.payload.fileHash);
  body.append("title", input.payload.title);
  body.append("source_channel", input.payload.sourceChannel);
  body.append("doc_type", input.payload.docType);
  appendOptional(body, "issuing_body", input.payload.issuingBody);
  appendOptional(body, "jurisdiction", input.payload.jurisdiction);
  appendOptional(body, "effective_date", input.payload.effectiveDate);
  appendOptional(body, "verification_method", input.payload.verificationMethod);
  appendOptional(body, "seed_batch_id", input.payload.seedBatchId);

  const response = await requestPipeline({
    actor: input.actor,
    method: "POST",
    path,
    body,
  });
  if (!response.ok) {
    throw new Error(
      `pipeline_rejected:${response.status}:${formatPipelineError(response.data)}`,
    );
  }
  return pipelineAcceptedSchema.parse(response.data);
}

function appendOptional(body: FormData, key: string, value: string | undefined) {
  if (value) body.append(key, value);
}
