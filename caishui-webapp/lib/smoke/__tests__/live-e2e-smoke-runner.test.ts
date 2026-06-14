import { describe, expect, it, vi } from "vitest";
import {
  createLiveE2ESmokeRunner,
  isLiveE2ESmokeEnabled,
} from "@/lib/smoke/live-e2e-smoke-runner";
import type { E2ESmokeHarnessInput } from "@/lib/smoke/e2e-smoke-harness";

describe("isLiveE2ESmokeEnabled", () => {
  it("requires explicit opt-in and all live dependencies", () => {
    expect(
      isLiveE2ESmokeEnabled({
        RUN_E2E_SMOKE: "true",
        DATABASE_URL: "postgresql://local",
        DATA_PIPELINE_URL: "http://127.0.0.1:8000",
        PIPELINE_SHARED_SECRET: "local-smoke-secret",
      }),
    ).toEqual({ enabled: true });

    expect(
      isLiveE2ESmokeEnabled({
        RUN_E2E_SMOKE: "true",
        DATABASE_URL: "postgresql://local",
        DATA_PIPELINE_URL: "http://127.0.0.1:8000",
      }),
    ).toEqual({
      enabled: false,
      reason: "missing_env:PIPELINE_SHARED_SECRET",
    });

    expect(
      isLiveE2ESmokeEnabled({
        DATABASE_URL: "postgresql://local",
        DATA_PIPELINE_URL: "http://127.0.0.1:8000",
        PIPELINE_SHARED_SECRET: "local-smoke-secret",
      }),
    ).toEqual({ enabled: false, reason: "RUN_E2E_SMOKE_not_true" });
  });
});

describe("createLiveE2ESmokeRunner", () => {
  it("runs harness with smoke adapters and a deterministic answer step", async () => {
    const harnessInputs: E2ESmokeHarnessInput[] = [];
    const runHarness = vi.fn(async (input: E2ESmokeHarnessInput) => {
      harnessInputs.push(input);
      return {
      ok: true as const,
      sourceDocumentId: "doc-1",
      taskId: "task-1",
      verifiedChunkIds: ["chunk-1"],
      answerId: "smoke-answer",
      citationCount: 1,
      trace: [],
      };
    });
    const createSteps = vi.fn(() => ({
      uploadSource: vi.fn(),
      confirmAcceptedTaskReady: vi.fn(),
      loadReviewableChunks: vi.fn(),
      verifyChunk: vi.fn(),
      triggerEmbedding: vi.fn(),
      retrieveForQuestion: vi.fn(),
      answerQuestion: vi.fn(),
    }));

    const runner = createLiveE2ESmokeRunner({
      runHarness,
      createSteps,
      cleanup: vi.fn(async () => undefined),
      verifyCleanup: vi.fn(async () => ({
        sourceDocuments: 0,
        knowledgeChunks: 0,
        ingestTasks: 0,
      })),
    });
    const result = await runner.run();
    const harnessInput = harnessInputs[0];
    if (!harnessInput) throw new Error("missing_harness_input");

    expect(result).toMatchObject({
      ok: true,
      answerId: "smoke-answer",
      citationCount: 1,
      cleanup: { ok: true, sourceDocumentId: "doc-1" },
    });
    await expect(
      harnessInput.steps.retrieveForQuestion({
        actor: { id: "e2e-smoke-admin", roles: ["admin", "reviewer"] },
        question: "研发费用加计扣除政策是什么？",
        sourceDocumentId: "doc-1",
        taskId: "task-1",
        verifiedChunkIds: ["chunk-1", "chunk-2"],
      }),
    ).resolves.toEqual({
      chunks: [{ id: "chunk-1" }, { id: "chunk-2" }],
    });
    expect(createSteps).toHaveBeenCalledWith({
      answerQuestion: expect.any(Function),
    });
    expect(runHarness).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: { id: "e2e-smoke-admin", roles: ["admin", "reviewer"] },
        question: "研发费用加计扣除政策是什么？",
        steps: expect.any(Object),
      }),
    );
  });

  it("cleans smoke source rows after the harness returns a source document id", async () => {
    const cleanup = vi.fn(async () => undefined);
    const runner = createLiveE2ESmokeRunner({
      cleanup,
      verifyCleanup: vi.fn(async () => ({
        sourceDocuments: 0,
        knowledgeChunks: 0,
        ingestTasks: 0,
      })),
      createSteps: vi.fn(() => ({
        uploadSource: vi.fn(),
        confirmAcceptedTaskReady: vi.fn(),
        loadReviewableChunks: vi.fn(),
        verifyChunk: vi.fn(),
        triggerEmbedding: vi.fn(),
        retrieveForQuestion: vi.fn(),
        answerQuestion: vi.fn(),
      })),
      runHarness: vi.fn(async () => ({
        ok: true as const,
        sourceDocumentId: "doc-smoke",
        taskId: "task-smoke",
        verifiedChunkIds: ["chunk-smoke"],
        answerId: "smoke-answer",
        citationCount: 1,
        trace: [],
      })),
    });

    const result = await runner.run();

    expect(cleanup).toHaveBeenCalledWith("doc-smoke");
    expect(result).toMatchObject({
      cleanup: { ok: true, sourceDocumentId: "doc-smoke" },
    });
  });

  it("preserves the smoke result when cleanup fails and reports cleanup diagnostics", async () => {
    const runner = createLiveE2ESmokeRunner({
      cleanup: vi.fn(async () => {
        throw new Error("delete ingest_tasks failed");
      }),
      verifyCleanup: vi.fn(async () => ({
        sourceDocuments: 1,
        knowledgeChunks: 0,
        ingestTasks: 1,
      })),
      createSteps: vi.fn(() => ({
        uploadSource: vi.fn(),
        confirmAcceptedTaskReady: vi.fn(),
        loadReviewableChunks: vi.fn(),
        verifyChunk: vi.fn(),
        triggerEmbedding: vi.fn(),
        retrieveForQuestion: vi.fn(),
        answerQuestion: vi.fn(),
      })),
      runHarness: vi.fn(async () => ({
        ok: false as const,
        failedStep: "trigger_embedding" as const,
        sourceDocumentId: "doc-smoke",
        taskId: "task-smoke",
        reason: "pipeline_embedding_unavailable",
        trace: [],
      })),
    });

    await expect(runner.run()).resolves.toMatchObject({
      ok: false,
      failedStep: "trigger_embedding",
      reason: "pipeline_embedding_unavailable",
      cleanup: {
        ok: false,
        sourceDocumentId: "doc-smoke",
        reason: "delete ingest_tasks failed",
      },
    });
  });

  it("reports cleanup residual rows after cleanup completes", async () => {
    const runner = createLiveE2ESmokeRunner({
      cleanup: vi.fn(async () => undefined),
      verifyCleanup: vi.fn(async () => ({
        sourceDocuments: 0,
        knowledgeChunks: 2,
        ingestTasks: 0,
      })),
      createSteps: vi.fn(() => ({
        uploadSource: vi.fn(),
        confirmAcceptedTaskReady: vi.fn(),
        loadReviewableChunks: vi.fn(),
        verifyChunk: vi.fn(),
        triggerEmbedding: vi.fn(),
        retrieveForQuestion: vi.fn(),
        answerQuestion: vi.fn(),
      })),
      runHarness: vi.fn(async () => ({
        ok: true as const,
        sourceDocumentId: "doc-smoke",
        taskId: "task-smoke",
        verifiedChunkIds: ["chunk-smoke"],
        answerId: "smoke-answer",
        citationCount: 1,
        trace: [],
      })),
    });

    await expect(runner.run()).resolves.toMatchObject({
      ok: true,
      cleanup: {
        ok: false,
        sourceDocumentId: "doc-smoke",
        reason: "cleanup_residual_rows",
        residualRows: {
          sourceDocuments: 0,
          knowledgeChunks: 2,
          ingestTasks: 0,
        },
      },
    });
  });
});
