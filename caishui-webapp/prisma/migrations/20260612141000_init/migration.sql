-- Initial schema for caishui-webapp architecture v2.1.
-- This migration intentionally folds Prisma-generated DDL and the manual
-- pgvector / JSONB / ingest_tasks / chunk lifecycle SQL into one source of
-- truth. The Python pipeline mirrors these tables for writes only; Prisma owns
-- the DDL.

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "DocType" AS ENUM ('REGULATION', 'ANNOUNCEMENT', 'NOTICE', 'INTERPRETATION', 'CASE', 'GUIDE');

-- CreateEnum
CREATE TYPE "FileType" AS ENUM ('PDF', 'MD', 'XLSX', 'CSV');

-- CreateEnum
CREATE TYPE "EmbeddingStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "RetrievalStatus" AS ENUM ('RETRIEVABLE', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "AnswerStatus" AS ENUM ('GENERATING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "source_documents" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_type" "FileType" NOT NULL,
    "file_size" INTEGER NOT NULL,
    "file_path" TEXT,
    "file_hash" TEXT NOT NULL,
    "processing_status" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "retrieval_status" "RetrievalStatus" NOT NULL DEFAULT 'RETRIEVABLE',
    "error_message" TEXT,
    "doc_type" "DocType",
    "doc_number" TEXT,
    "publish_date" TIMESTAMP(3),
    "effective_date" TIMESTAMP(3),
    "expire_date" TIMESTAMP(3),
    "jurisdiction" TEXT,
    "issuing_body" TEXT,
    "source_channel" TEXT,
    "authority_rank" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "source_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_chunks" (
    "id" TEXT NOT NULL,
    "pipeline_chunk_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "chunk_type" TEXT NOT NULL DEFAULT 'text',
    "embedding" vector(1024),
    "embedding_status" "EmbeddingStatus" NOT NULL DEFAULT 'PENDING',
    "embedding_error" TEXT,
    "embedding_identity" TEXT,
    "embedding_model" TEXT,
    "embedding_dimension" INTEGER,
    "embedding_attempts" INTEGER NOT NULL DEFAULT 0,
    "embedding_last_attempt_at" TIMESTAMP(3),
    "publish_date" TIMESTAMP(3),
    "effective_date" TIMESTAMP(3),
    "expire_date" TIMESTAMP(3),
    "jurisdiction" TEXT,
    "source_channel" TEXT,
    "doc_type" "DocType",
    "authority_rank" INTEGER,
    "is_current_version" BOOLEAN NOT NULL DEFAULT true,
    "version_of_provision" TEXT,
    "verification_status" TEXT NOT NULL DEFAULT 'unverified',
    "verification_method" TEXT,
    "verified_by" TEXT,
    "verified_at" TIMESTAMP(3),
    "verification_notes" TEXT,
    "provision_type" TEXT NOT NULL DEFAULT 'operative',
    "answer_role" TEXT,
    "retrieval_status" "RetrievalStatus" NOT NULL DEFAULT 'RETRIEVABLE',
    "withdrawn_at" TIMESTAMP(3),
    "withdrawn_by" TEXT,
    "withdrawal_reason" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "answers" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "original_question" TEXT NOT NULL,
    "retrieval_query" TEXT,
    "context_snapshot" JSONB,
    "status" "AnswerStatus" NOT NULL DEFAULT 'GENERATING',
    "draft_text" TEXT,
    "answer_text" TEXT,
    "model" TEXT NOT NULL,
    "prompt_template_version" TEXT NOT NULL,
    "coverage_evidence_snapshot" JSONB NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "error_code" TEXT,
    "error_message" TEXT,

    CONSTRAINT "answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "answer_citations" (
    "id" TEXT NOT NULL,
    "answer_id" TEXT NOT NULL,
    "chunk_id" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "answer_citations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "citation_annotations" (
    "id" TEXT NOT NULL,
    "answer_citation_id" TEXT NOT NULL,
    "annotation_type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "citation_annotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "old_state" JSONB,
    "new_state" JSONB,
    "reason" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "source_documents_processing_status_idx" ON "source_documents"("processing_status");

-- CreateIndex
CREATE INDEX "source_documents_file_hash_source_channel_idx" ON "source_documents"("file_hash", "source_channel");

-- CreateIndex
CREATE INDEX "source_documents_retrieval_status_idx" ON "source_documents"("retrieval_status");

-- CreateIndex
CREATE INDEX "source_documents_doc_type_idx" ON "source_documents"("doc_type");

-- CreateIndex
CREATE INDEX "source_documents_publish_date_idx" ON "source_documents"("publish_date");

-- CreateIndex
CREATE INDEX "source_documents_effective_date_idx" ON "source_documents"("effective_date");

-- CreateIndex
CREATE INDEX "source_documents_jurisdiction_idx" ON "source_documents"("jurisdiction");

-- CreateIndex
CREATE INDEX "source_documents_authority_rank_idx" ON "source_documents"("authority_rank");

-- CreateIndex
CREATE INDEX "knowledge_chunks_document_id_idx" ON "knowledge_chunks"("document_id");

-- CreateIndex
CREATE INDEX "knowledge_chunks_pipeline_chunk_id_idx" ON "knowledge_chunks"("pipeline_chunk_id");

-- CreateIndex
CREATE INDEX "knowledge_chunks_chunk_index_idx" ON "knowledge_chunks"("chunk_index");

-- CreateIndex
CREATE INDEX "knowledge_chunks_jurisdiction_idx" ON "knowledge_chunks"("jurisdiction");

-- CreateIndex
CREATE INDEX "knowledge_chunks_publish_date_idx" ON "knowledge_chunks"("publish_date");

-- CreateIndex
CREATE INDEX "knowledge_chunks_effective_date_idx" ON "knowledge_chunks"("effective_date");

-- CreateIndex
CREATE INDEX "knowledge_chunks_authority_rank_idx" ON "knowledge_chunks"("authority_rank");

-- CreateIndex
CREATE INDEX "knowledge_chunks_is_current_version_idx" ON "knowledge_chunks"("is_current_version");

-- CreateIndex
CREATE INDEX "knowledge_chunks_verification_status_idx" ON "knowledge_chunks"("verification_status");

-- CreateIndex
CREATE INDEX "knowledge_chunks_provision_type_idx" ON "knowledge_chunks"("provision_type");

-- CreateIndex
CREATE INDEX "knowledge_chunks_embedding_status_idx" ON "knowledge_chunks"("embedding_status");

-- CreateIndex
CREATE INDEX "knowledge_chunks_retrieval_status_idx" ON "knowledge_chunks"("retrieval_status");

-- CreateIndex
CREATE INDEX "answers_conversation_id_idx" ON "answers"("conversation_id");

-- CreateIndex
CREATE INDEX "answers_status_idx" ON "answers"("status");

-- CreateIndex
CREATE INDEX "answers_started_at_idx" ON "answers"("started_at");

-- CreateIndex
CREATE INDEX "answer_citations_answer_id_idx" ON "answer_citations"("answer_id");

-- CreateIndex
CREATE INDEX "answer_citations_chunk_id_idx" ON "answer_citations"("chunk_id");

-- CreateIndex
CREATE INDEX "citation_annotations_answer_citation_id_idx" ON "citation_annotations"("answer_citation_id");

-- CreateIndex
CREATE INDEX "audit_events_actor_id_idx" ON "audit_events"("actor_id");

-- CreateIndex
CREATE INDEX "audit_events_action_idx" ON "audit_events"("action");

-- CreateIndex
CREATE INDEX "audit_events_target_type_target_id_idx" ON "audit_events"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "audit_events_created_at_idx" ON "audit_events"("created_at");

-- AddForeignKey
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "source_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answer_citations" ADD CONSTRAINT "answer_citations_answer_id_fkey" FOREIGN KEY ("answer_id") REFERENCES "answers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citation_annotations" ADD CONSTRAINT "citation_annotations_answer_citation_id_fkey" FOREIGN KEY ("answer_citation_id") REFERENCES "answer_citations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Manual pgvector / JSONB / temporal indexes.
CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_hnsw_idx
  ON knowledge_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS knowledge_chunks_metadata_gin_idx
  ON knowledge_chunks
  USING GIN (metadata);

CREATE INDEX IF NOT EXISTS knowledge_chunks_expire_date_idx
  ON knowledge_chunks (expire_date)
  WHERE expire_date IS NOT NULL;

-- Manual pipeline task table. The data-pipeline service reads/writes it, but
-- Prisma migrations own the DDL. Do not create it from SQLAlchemy.
CREATE TABLE IF NOT EXISTS ingest_tasks (
  task_id           TEXT PRIMARY KEY,
  document_id       TEXT NOT NULL REFERENCES source_documents(id) ON DELETE RESTRICT,
  status            TEXT NOT NULL CHECK (
    status IN ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED')
  ),
  completed_chunks  INTEGER NOT NULL DEFAULT 0 CHECK (completed_chunks >= 0),
  total_chunks      INTEGER NOT NULL DEFAULT 0 CHECK (total_chunks >= 0),
  error_message     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ingest_tasks_document_id_idx ON ingest_tasks(document_id);
CREATE INDEX IF NOT EXISTS ingest_tasks_status_idx ON ingest_tasks(status);
CREATE INDEX IF NOT EXISTS ingest_tasks_updated_at_idx ON ingest_tasks(updated_at);

-- Chunk lifecycle invariant: one Source Document + stable Chunk Location may
-- have at most one current row.
CREATE UNIQUE INDEX IF NOT EXISTS knowledge_chunks_one_current_version_idx
  ON knowledge_chunks (document_id, pipeline_chunk_id)
  WHERE is_current_version = true;
