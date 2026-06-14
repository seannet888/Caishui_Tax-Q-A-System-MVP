import { describe, expect, it, vi } from "vitest";
import { createE2ESmokeSteps } from "@/lib/smoke/e2e-smoke-adapters";

describe("createE2ESmokeSteps", () => {
  it("wires upload source through source ingestion and pipeline ingest adapters", async () => {
    const prepareSourceDocumentIngestion = vi.fn(async () => ({
      sourceDocumentId: "doc-1",
      pipelinePayload: {
        documentId: "doc-1",
        fileName: "smoke.md",
        bytes: Buffer.from("# smoke"),
        fileHash: "hash",
        title: "Smoke Source",
        sourceChannel: "local-smoke",
        docType: "notice" as const,
      },
    }));
    const startPipelineIngest = vi.fn(async () => ({
      task_id: "00000000-0000-4000-8000-000000000001",
      document_id: "doc-1",
      status: "PENDING" as const,
    }));

    const steps = createE2ESmokeSteps({
      prepareSourceDocumentIngestion,
      startPipelineIngest,
      answerQuestion: async () => ({ answerId: "answer-1", citationCount: 1 }),
    });

    const result = await steps.uploadSource({
      actor: { id: "admin-1", roles: ["admin"] },
      source: {
        fileName: "smoke.md",
        bytes: Buffer.from("# smoke"),
        title: "Smoke Source",
        sourceChannel: "local-smoke",
      },
    });

    expect(result).toEqual({
      sourceDocumentId: "doc-1",
      taskId: "00000000-0000-4000-8000-000000000001",
    });
    expect(prepareSourceDocumentIngestion).toHaveBeenCalledWith({
      actor: { id: "admin-1", roles: ["admin"] },
      file: {
        name: "smoke.md",
        size: Buffer.from("# smoke").byteLength,
        bytes: Buffer.from("# smoke"),
      },
      title: "Smoke Source",
      sourceChannel: "local-smoke",
      docType: "notice",
      jurisdiction: "全国",
      issuingBody: "国家税务总局",
    });
    expect(startPipelineIngest).toHaveBeenCalledWith({
      actor: { id: "admin-1", roles: ["admin"] },
      payload: expect.objectContaining({
        documentId: "doc-1",
        docType: "notice",
      }),
    });
  });

  it("maps readiness, review, embedding, retrieval, and answer steps to existing modules", async () => {
    const waitForIngestCompletion = vi.fn(async () => ({
      ready: true as const,
      taskId: "task-1",
      documentId: "doc-1",
      taskStatus: "SUCCESS" as const,
    }));
    const loadDocumentReview = vi.fn(async () => ({
      document: {
        id: "doc-1",
        title: "Smoke Source",
        docNumber: null,
        processingStatus: "COMPLETED",
        retrievalStatus: "RETRIEVABLE",
        errorMessage: null,
        publishDate: null,
        effectiveDate: null,
      },
      chunks: [
        { id: "chunk-reviewable", canReview: true },
        { id: "chunk-verified", canReview: false },
      ],
    }));
    const verifyChunkHuman = vi.fn(async () => undefined);
    const triggerChunkEmbedding = vi.fn(async () => ({
      ok: true,
      status: "QUEUED" as const,
    }));
    const retrieve = vi.fn(async () => ({
      chunks: [{ id: "chunk-reviewable" }],
      coverageEvidence: { sourcesHit: [], dateRange: {} },
      queryPlan: { executions: [] },
    }));
    const answerQuestion = vi.fn(async () => ({
      answerId: "answer-1",
      citationCount: 1,
    }));

    const steps = createE2ESmokeSteps({
      waitForIngestCompletion,
      loadDocumentReview: loadDocumentReview as never,
      verifyChunkHuman,
      triggerChunkEmbedding,
      retrieve: retrieve as never,
      answerQuestion,
    });
    const actor = { id: "reviewer-1", roles: ["reviewer" as const] };

    await expect(
      steps.confirmAcceptedTaskReady({
        actor,
        sourceDocumentId: "doc-1",
        taskId: "task-1",
      }),
    ).resolves.toEqual({ ready: true });
    await expect(
      steps.loadReviewableChunks({ actor, sourceDocumentId: "doc-1" }),
    ).resolves.toEqual([{ id: "chunk-reviewable" }]);
    await steps.verifyChunk({ actor, chunkId: "chunk-reviewable" });
    await expect(
      steps.triggerEmbedding({ actor, chunkId: "chunk-reviewable" }),
    ).resolves.toEqual({ ok: true, status: "QUEUED" });
    await expect(
      steps.retrieveForQuestion({
        actor,
        question: "研发费用政策",
        sourceDocumentId: "doc-1",
        taskId: "task-1",
        verifiedChunkIds: ["chunk-reviewable"],
      }),
    ).resolves.toEqual({ chunks: [{ id: "chunk-reviewable" }] });
    await expect(
      steps.answerQuestion({
        actor,
        question: "研发费用政策",
        chunkIds: ["chunk-reviewable"],
      }),
    ).resolves.toEqual({ answerId: "answer-1", citationCount: 1 });

    expect(waitForIngestCompletion).toHaveBeenCalledWith({
      actor,
      accepted: {
        task_id: "task-1",
        document_id: "doc-1",
        status: "PENDING",
      },
    });
    expect(verifyChunkHuman).toHaveBeenCalledWith(
      "chunk-reviewable",
      actor,
      "E2E smoke human verification",
    );
    expect(triggerChunkEmbedding).toHaveBeenCalledWith("chunk-reviewable", actor);
    expect(retrieve).toHaveBeenCalledWith({ query: "研发费用政策" });
    expect(answerQuestion).toHaveBeenCalledWith({
      actor,
      question: "研发费用政策",
      chunkIds: ["chunk-reviewable"],
    });
  });
});
