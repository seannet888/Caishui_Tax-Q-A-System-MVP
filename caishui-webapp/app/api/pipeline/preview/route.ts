import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/actor";
import {
  loadPreviewSnapshot,
  savePreviewSnapshot,
} from "@/lib/knowledge/preview-persistence";
import { normalizeDocType } from "@/lib/knowledge/doc-type-mapping";
import {
  domainErrorResponse,
  resolveActorFromRequest,
} from "@/lib/knowledge/admin-action-adapter";
import {
  uploadValidationErrorResponse,
  validateUploadedFile,
} from "@/lib/knowledge/upload-validation";
import { startPipelinePreview } from "@/lib/pipeline/preview-client";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const previewId = new URL(request.url).searchParams.get("previewId");
  if (!previewId) {
    return NextResponse.json({ error: "previewId_required" }, { status: 400 });
  }
  const snapshot = loadPreviewSnapshot(previewId);
  if (!snapshot) {
    return NextResponse.json({ error: "preview_not_found" }, { status: 404 });
  }
  return NextResponse.json(snapshot);
}

export async function POST(request: NextRequest) {
  const actor = resolveActorFromRequest(request);
  try {
    requireRole(actor, "admin");
  } catch (error) {
    return domainErrorResponse(error);
  }
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
  try {
    const output = await startPipelinePreview({
      actor,
      fileName: file.name,
      bytes,
      title: stringField(form.get("title")),
      sourceChannel: stringField(form.get("sourceChannel")),
      issuingBody: stringField(form.get("issuingBody")),
      jurisdiction: stringField(form.get("jurisdiction")),
      docType: normalizeDocType(stringField(form.get("docType"))).pipeline,
    });
    const saved = savePreviewSnapshot({
      actor,
      fileName: file.name,
      sourceChannel: stringField(form.get("sourceChannel")) ?? "",
      output,
    });

    return NextResponse.json({ previewId: saved.previewId, output });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

function stringField(value: FormDataEntryValue | null): string | undefined {
  return typeof value === "string" ? value.trim() : undefined;
}
