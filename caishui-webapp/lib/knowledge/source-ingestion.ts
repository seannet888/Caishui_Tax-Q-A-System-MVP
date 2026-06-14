import { createHash } from "node:crypto";
import { DocType, FileType, ProcessingStatus } from "@prisma/client";
import { requireRole, type Actor } from "@/lib/auth/actor";
import { prisma } from "@/lib/db/client";
import { normalizeDocType } from "@/lib/knowledge/doc-type-mapping";
import type { DocType as PipelineDocType } from "@/types/pipeline";

const FILE_TYPES: Record<string, FileType> = {
  pdf: FileType.PDF,
  md: FileType.MD,
  markdown: FileType.MD,
  xlsx: FileType.XLSX,
  csv: FileType.CSV,
};

export interface SourceUploadFile {
  name: string;
  size: number;
  bytes: Buffer;
}

export interface SourceIngestionInput {
  actor: Actor;
  file: SourceUploadFile;
  title?: string;
  sourceChannel?: string;
  docType?: string;
  effectiveDate?: string;
  jurisdiction?: string;
  issuingBody?: string;
  seedVerified?: boolean;
  seedBatchId?: string;
}

export interface PipelineIngestPayload {
  fileName: string;
  bytes: Buffer;
  documentId: string;
  fileHash: string;
  title: string;
  sourceChannel: string;
  docType: PipelineDocType;
  effectiveDate?: string;
  jurisdiction?: string;
  issuingBody?: string;
  verificationMethod?: "seed";
  seedBatchId?: string;
}

export async function prepareSourceDocumentIngestion(
  input: SourceIngestionInput,
): Promise<{ sourceDocumentId: string; pipelinePayload: PipelineIngestPayload }> {
  requireRole(input.actor, "admin");

  const extension = input.file.name.split(".").pop()?.toLowerCase() ?? "";
  const fileType = FILE_TYPES[extension];
  if (!fileType) throw new Error("unsupported_file_type");

  const sourceChannel = input.sourceChannel?.trim() ?? "";
  if (!sourceChannel) throw new Error("source_channel_required");

  const docType = normalizeDocType(input.docType);
  const fileHash = createHash("sha256").update(input.file.bytes).digest("hex");

  const duplicate = await prisma.sourceDocument.findFirst({
    where: { file_hash: fileHash, source_channel: sourceChannel },
    select: { id: true },
  });
  if (duplicate) {
    throw new Error(`source_document_already_exists:${duplicate.id}`);
  }

  const effectiveDate = optionalDate(input.effectiveDate);
  const title = input.title?.trim() || input.file.name;
  const jurisdiction = input.jurisdiction?.trim() || null;
  const issuingBody = input.issuingBody?.trim() || null;

  const sourceDocument = await prisma.$transaction(async (tx) => {
    const created = await tx.sourceDocument.create({
      data: {
        title,
        file_name: input.file.name,
        file_type: fileType,
        file_size: input.file.size,
        file_hash: fileHash,
        processing_status: ProcessingStatus.PENDING,
        doc_type: docType.prisma,
        effective_date: effectiveDate,
        jurisdiction,
        issuing_body: issuingBody,
        source_channel: sourceChannel,
      },
    });
    await tx.auditEvent.create({
      data: {
        actor_id: input.actor.id,
        action: "upload",
        target_type: "SourceDocument",
        target_id: created.id,
        new_state: {
          processing_status: ProcessingStatus.PENDING,
          source_channel: sourceChannel,
          file_hash: fileHash,
        },
      },
    });
    return created;
  });

  return {
    sourceDocumentId: sourceDocument.id,
    pipelinePayload: {
      fileName: input.file.name,
      bytes: input.file.bytes,
      documentId: sourceDocument.id,
      fileHash,
      title: sourceDocument.title,
      sourceChannel,
      issuingBody: sourceDocument.issuing_body ?? undefined,
      jurisdiction: sourceDocument.jurisdiction ?? undefined,
      docType: docType.pipeline,
      effectiveDate: sourceDocument.effective_date
        ? sourceDocument.effective_date.toISOString().slice(0, 10)
        : undefined,
      verificationMethod: input.seedVerified ? "seed" : undefined,
      seedBatchId: input.seedVerified
        ? input.seedBatchId ?? "mvp-seed"
        : undefined,
    },
  };
}

export async function markSourceIngestionFailed(
  sourceDocumentId: string,
  actor: Actor,
  reason: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.sourceDocument.update({
      where: { id: sourceDocumentId },
      data: {
        processing_status: ProcessingStatus.FAILED,
        error_message: reason,
      },
    });
    await tx.auditEvent.create({
      data: {
        actor_id: actor.id,
        action: "ingest_failed",
        target_type: "SourceDocument",
        target_id: sourceDocumentId,
        reason,
      },
    });
  });
}

function optionalDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) throw new Error("invalid_effective_date");
  return parsed;
}
