import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { Actor } from "@/lib/auth/actor";
import type { PipelineIngestPayload } from "@/lib/knowledge/source-ingestion";
import type { startPipelineIngest } from "@/lib/pipeline/ingest-client";
import type { startPipelinePreview } from "@/lib/pipeline/preview-client";

export const LIVE_HANDSHAKE_ACTOR: Actor = {
  id: "live-handshake-admin",
  roles: ["admin"],
};

type LiveHandshakeEnv = Record<string, string | undefined>;

const LIVE_SOURCE_CHANNEL = "live-handshake";
const LIVE_ISSUING_BODY = "国家税务总局";
const LIVE_JURISDICTION = "全国";

type PreviewInput = Parameters<typeof startPipelinePreview>[0];
type IngestInput = Parameters<typeof startPipelineIngest>[0];

export function isLiveHandshakeEnabled(env: LiveHandshakeEnv = process.env): boolean {
  return (
    env.RUN_PIPELINE_LIVE === "true" &&
    Boolean(env.DATA_PIPELINE_URL) &&
    Boolean(env.PIPELINE_SHARED_SECRET)
  );
}

export function isLiveIngestEnabled(env: LiveHandshakeEnv = process.env): boolean {
  return isLiveHandshakeEnabled(env) && Boolean(env.DATABASE_URL);
}

export function buildLivePreviewInput(): PreviewInput {
  return {
    actor: LIVE_HANDSHAKE_ACTOR,
    fileName: "live-preview.md",
    bytes: Buffer.from("# 测试政策\n\n第一条 本文件用于验证 preview handshake。"),
    title: "Live Preview Handshake",
    sourceChannel: LIVE_SOURCE_CHANNEL,
    issuingBody: LIVE_ISSUING_BODY,
    jurisdiction: LIVE_JURISDICTION,
    docType: "notice",
  };
}

export function buildLiveIngestInput(documentId = `live-ingest-${Date.now()}`): IngestInput {
  const bytes = Buffer.from("# 测试政策\n\n第一条 本文件用于验证 ingest handshake。");
  const fileHash = createHash("sha256").update(bytes).digest("hex");

  return {
    actor: LIVE_HANDSHAKE_ACTOR,
    payload: {
      documentId,
      fileName: "live-ingest.md",
      fileHash,
      bytes,
      title: "Live Ingest Handshake",
      sourceChannel: LIVE_SOURCE_CHANNEL,
      issuingBody: LIVE_ISSUING_BODY,
      jurisdiction: LIVE_JURISDICTION,
      docType: "notice",
    },
  };
}

export async function withLiveIngestSourceDocument<T>(
  prisma: PrismaClient,
  input: IngestInput,
  run: (input: IngestInput) => Promise<T>,
): Promise<T> {
  await createSourceDocument(prisma, input.payload);
  try {
    return await run(input);
  } finally {
    await cleanupSourceDocument(prisma, input.payload.documentId);
  }
}

async function createSourceDocument(
  prisma: PrismaClient,
  payload: PipelineIngestPayload,
) {
  await prisma.sourceDocument.create({
    data: {
      id: payload.documentId,
      title: payload.title,
      file_name: payload.fileName,
      file_type: "MD",
      file_size: payload.bytes.byteLength,
      file_hash: payload.fileHash,
      source_channel: payload.sourceChannel,
      issuing_body: payload.issuingBody,
      jurisdiction: payload.jurisdiction,
      doc_type: "NOTICE",
    },
  });
}

async function cleanupSourceDocument(prisma: PrismaClient, documentId: string) {
  await prisma.$executeRaw`DELETE FROM ingest_tasks WHERE document_id = ${documentId}`;
  await prisma.knowledgeChunk.deleteMany({ where: { document_id: documentId } });
  await prisma.sourceDocument.deleteMany({ where: { id: documentId } });
}
