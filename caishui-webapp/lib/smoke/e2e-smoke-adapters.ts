import type { Actor } from "@/lib/auth/actor";
import {
  prepareSourceDocumentIngestion,
  type PipelineIngestPayload,
  type SourceIngestionInput,
} from "@/lib/knowledge/source-ingestion";
import { loadDocumentReview } from "@/lib/knowledge/document-review-read-model";
import { retrieve } from "@/lib/knowledge/retriever";
import { verifyChunkHuman } from "@/lib/knowledge/chunk-review";
import { startPipelineIngest } from "@/lib/pipeline/ingest-client";
import { waitForIngestCompletion } from "@/lib/pipeline/ingest-completion-readiness";
import { triggerChunkEmbedding } from "@/lib/pipeline/embedding-trigger";
import type { E2ESmokeHarnessInput } from "@/lib/smoke/e2e-smoke-harness";

type SmokeSteps = E2ESmokeHarnessInput["steps"];

interface SmokeAdapterDependencies {
  prepareSourceDocumentIngestion?: typeof prepareSourceDocumentIngestion;
  startPipelineIngest?: typeof startPipelineIngest;
  waitForIngestCompletion?: typeof waitForIngestCompletion;
  loadDocumentReview?: typeof loadDocumentReview;
  verifyChunkHuman?: typeof verifyChunkHuman;
  triggerChunkEmbedding?: typeof triggerChunkEmbedding;
  retrieve?: typeof retrieve;
  answerQuestion: SmokeSteps["answerQuestion"];
}

export function createE2ESmokeSteps(
  dependencies: SmokeAdapterDependencies,
): SmokeSteps {
  const deps = {
    prepareSourceDocumentIngestion,
    startPipelineIngest,
    waitForIngestCompletion,
    loadDocumentReview,
    verifyChunkHuman,
    triggerChunkEmbedding,
    retrieve,
    ...dependencies,
  };

  return {
    async uploadSource({ actor, source }) {
      const prepared = await deps.prepareSourceDocumentIngestion({
        actor,
        file: {
          name: source.fileName,
          size: source.bytes.byteLength,
          bytes: source.bytes,
        },
        title: source.title,
        sourceChannel: source.sourceChannel,
        docType: "notice",
        jurisdiction: "全国",
        issuingBody: "国家税务总局",
      } satisfies SourceIngestionInput);
      const accepted = await deps.startPipelineIngest({
        actor,
        payload: prepared.pipelinePayload as PipelineIngestPayload,
      });

      return {
        sourceDocumentId: prepared.sourceDocumentId,
        taskId: accepted.task_id,
      };
    },

    async confirmAcceptedTaskReady({ actor, sourceDocumentId, taskId }) {
      const readiness = await deps.waitForIngestCompletion({
        actor,
        accepted: {
          task_id: taskId,
          document_id: sourceDocumentId,
          status: "PENDING",
        },
      });
      return readiness.ready
        ? { ready: true }
        : {
            ready: false,
            reason: readiness.errorMessage
              ? `${readiness.reason}:${readiness.errorMessage}`
              : readiness.reason,
          };
    },

    async loadReviewableChunks({ sourceDocumentId }) {
      const review = await deps.loadDocumentReview(sourceDocumentId);
      return (review?.chunks ?? [])
        .filter((chunk) => chunk.canReview)
        .map((chunk) => ({ id: chunk.id }));
    },

    async verifyChunk({ actor, chunkId }) {
      await deps.verifyChunkHuman(
        chunkId,
        actor,
        "E2E smoke human verification",
      );
    },

    async triggerEmbedding({ actor, chunkId }) {
      return deps.triggerChunkEmbedding(chunkId, actor);
    },

    async retrieveForQuestion({ question }) {
      const result = await deps.retrieve({ query: question });
      return {
        chunks: result.chunks.map((chunk) => ({ id: chunk.id })),
      };
    },

    answerQuestion: dependencies.answerQuestion,
  };
}
