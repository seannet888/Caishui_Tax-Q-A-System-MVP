import { NextRequest, NextResponse } from "next/server";
import {
  markSourceIngestionFailed,
  prepareSourceDocumentIngestion,
} from "@/lib/knowledge/source-ingestion";
import {
  domainErrorResponse,
  resolveActorFromRequest,
} from "@/lib/knowledge/admin-action-adapter";
import {
  uploadValidationErrorResponse,
  validateUploadedFile,
} from "@/lib/knowledge/upload-validation";
import { startPipelineIngest } from "@/lib/pipeline/ingest-client";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const actor = resolveActorFromRequest(request);

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file_required" }, { status: 400 });
  }
  try {
    validateUploadedFile(file);
  } catch (error) {
    const mapped = uploadValidationErrorResponse(error);
    if (mapped) {
      return NextResponse.json(
        { error: mapped.error },
        { status: mapped.status },
      );
    }
    throw error;
  }
  const bytes = Buffer.from(await file.arrayBuffer());

  let prepared: Awaited<ReturnType<typeof prepareSourceDocumentIngestion>>;
  try {
    prepared = await prepareSourceDocumentIngestion({
      actor,
      file: {
        name: file.name,
        size: file.size,
        bytes,
      },
      title: stringField(form.get("title")),
      sourceChannel: stringField(form.get("sourceChannel")),
      docType: stringField(form.get("docType")) || "notice",
      effectiveDate: stringField(form.get("effectiveDate")),
      jurisdiction: stringField(form.get("jurisdiction")),
      issuingBody: stringField(form.get("issuingBody")),
      seedVerified: form.get("seedVerified") === "true",
      seedBatchId: stringField(form.get("seedBatchId")) || "mvp-seed",
    });
  } catch (error) {
    return mapUploadError(error);
  }

  try {
    const accepted = await startPipelineIngest({
      actor,
      payload: prepared.pipelinePayload,
    });
    return NextResponse.json(accepted, { status: 202 });
  } catch (error) {
    const detail = String(error);
    await markSourceIngestionFailed(
      prepared.sourceDocumentId,
      actor,
      detail,
    );
    return NextResponse.json(
      {
        error: "pipeline_unavailable",
        detail,
        sourceDocumentId: prepared.sourceDocumentId,
      },
      { status: 502 },
    );
  }
}

function stringField(value: FormDataEntryValue | null): string | undefined {
  return typeof value === "string" ? value.trim() : undefined;
}

function mapUploadError(error: unknown): NextResponse {
  return domainErrorResponse(error);
}
