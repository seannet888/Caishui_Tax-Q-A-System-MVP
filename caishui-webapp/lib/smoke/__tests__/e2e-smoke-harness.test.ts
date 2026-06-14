import { describe, expect, it } from "vitest";
import { runE2ESmokeHarness } from "@/lib/smoke/e2e-smoke-harness";

describe("runE2ESmokeHarness", () => {
  it("runs the upload-to-answer smoke path and returns a structured trace", async () => {
    const calls: string[] = [];

    const result = await runE2ESmokeHarness({
      actor: { id: "admin-1", roles: ["admin", "reviewer"] },
      source: {
        fileName: "smoke.md",
        bytes: Buffer.from("# 测试政策\n\n第一条 研发费用加计扣除。"),
        title: "Smoke Source",
        sourceChannel: "local-smoke",
      },
      question: "研发费用加计扣除政策是什么？",
      steps: {
        uploadSource: async () => {
          calls.push("uploadSource");
          return { sourceDocumentId: "doc-1", taskId: "task-1" };
        },
        confirmAcceptedTaskReady: async ({ sourceDocumentId, taskId }) => {
          calls.push(`confirm:${sourceDocumentId}:${taskId}`);
          return { ready: true };
        },
        loadReviewableChunks: async ({ sourceDocumentId }) => {
          calls.push(`loadChunks:${sourceDocumentId}`);
          return [{ id: "chunk-1" }];
        },
        verifyChunk: async ({ chunkId }) => {
          calls.push(`verify:${chunkId}`);
        },
        triggerEmbedding: async ({ chunkId }) => {
          calls.push(`embed:${chunkId}`);
          return { ok: true };
        },
        retrieveForQuestion: async ({
          question,
          sourceDocumentId,
          taskId,
          verifiedChunkIds,
        }) => {
          calls.push(
            `retrieve:${question}:${sourceDocumentId}:${taskId}:${verifiedChunkIds.join(",")}`,
          );
          return { chunks: [{ id: "chunk-1" }] };
        },
        answerQuestion: async ({ question, chunkIds }) => {
          calls.push(`answer:${question}:${chunkIds.join(",")}`);
          return { answerId: "answer-1", citationCount: 1 };
        },
      },
    });

    expect(calls).toEqual([
      "uploadSource",
      "confirm:doc-1:task-1",
      "loadChunks:doc-1",
      "verify:chunk-1",
      "embed:chunk-1",
      "retrieve:研发费用加计扣除政策是什么？:doc-1:task-1:chunk-1",
      "answer:研发费用加计扣除政策是什么？:chunk-1",
    ]);
    expect(result).toEqual({
      ok: true,
      sourceDocumentId: "doc-1",
      taskId: "task-1",
      verifiedChunkIds: ["chunk-1"],
      answerId: "answer-1",
      citationCount: 1,
      trace: [
        { step: "upload_source", status: "passed" },
        { step: "accepted_task_readiness", status: "passed" },
        { step: "load_reviewable_chunks", status: "passed" },
        { step: "human_verify_chunk", status: "passed", targetId: "chunk-1" },
        { step: "trigger_embedding", status: "passed", targetId: "chunk-1" },
        { step: "retrieve_question", status: "passed" },
        { step: "answer_question", status: "passed" },
      ],
    });
  });

  it("stops with a diagnostic trace when accepted task readiness fails", async () => {
    const calls: string[] = [];

    const result = await runE2ESmokeHarness({
      actor: { id: "admin-1", roles: ["admin", "reviewer"] },
      source: {
        fileName: "smoke.md",
        bytes: Buffer.from("# 测试政策"),
        title: "Smoke Source",
        sourceChannel: "local-smoke",
      },
      question: "研发费用加计扣除政策是什么？",
      steps: {
        uploadSource: async () => {
          calls.push("uploadSource");
          return { sourceDocumentId: "doc-1", taskId: "task-1" };
        },
        confirmAcceptedTaskReady: async () => {
          calls.push("confirm");
          return { ready: false, reason: "task_not_found" };
        },
        loadReviewableChunks: async () => {
          calls.push("loadChunks");
          return [{ id: "chunk-1" }];
        },
        verifyChunk: async () => {
          calls.push("verify");
        },
        triggerEmbedding: async () => {
          calls.push("embed");
          return { ok: true };
        },
        retrieveForQuestion: async () => {
          calls.push("retrieve");
          return { chunks: [] };
        },
        answerQuestion: async () => {
          calls.push("answer");
          return { answerId: "answer-1", citationCount: 0 };
        },
      },
    });

    expect(calls).toEqual(["uploadSource", "confirm"]);
    expect(result).toEqual({
      ok: false,
      failedStep: "accepted_task_readiness",
      sourceDocumentId: "doc-1",
      taskId: "task-1",
      reason: "task_not_found",
      trace: [
        { step: "upload_source", status: "passed" },
        {
          step: "accepted_task_readiness",
          status: "failed",
          reason: "task_not_found",
        },
      ],
    });
  });

  it("converts thrown step errors into a structured failure with cleanup identities", async () => {
    const result = await runE2ESmokeHarness({
      actor: { id: "admin-1", roles: ["admin", "reviewer"] },
      source: {
        fileName: "smoke.md",
        bytes: Buffer.from("# 测试政策"),
        title: "Smoke Source",
        sourceChannel: "local-smoke",
      },
      question: "研发费用加计扣除政策是什么？",
      steps: {
        uploadSource: async () => ({ sourceDocumentId: "doc-1", taskId: "task-1" }),
        confirmAcceptedTaskReady: async () => {
          throw new Error("pipeline_status_unreachable");
        },
        loadReviewableChunks: async () => [{ id: "chunk-1" }],
        verifyChunk: async () => undefined,
        triggerEmbedding: async () => ({ ok: true }),
        retrieveForQuestion: async () => ({ chunks: [] }),
        answerQuestion: async () => ({ answerId: "answer-1", citationCount: 0 }),
      },
    });

    expect(result).toEqual({
      ok: false,
      failedStep: "accepted_task_readiness",
      sourceDocumentId: "doc-1",
      taskId: "task-1",
      reason: "pipeline_status_unreachable",
      trace: [
        { step: "upload_source", status: "passed" },
        {
          step: "accepted_task_readiness",
          status: "failed",
          reason: "pipeline_status_unreachable",
        },
      ],
    });
  });

  it("stops before retrieval when embedding trigger fails for a verified chunk", async () => {
    const calls: string[] = [];

    const result = await runE2ESmokeHarness({
      actor: { id: "admin-1", roles: ["admin", "reviewer"] },
      source: {
        fileName: "smoke.md",
        bytes: Buffer.from("# 测试政策"),
        title: "Smoke Source",
        sourceChannel: "local-smoke",
      },
      question: "研发费用加计扣除政策是什么？",
      steps: {
        uploadSource: async () => ({ sourceDocumentId: "doc-1", taskId: "task-1" }),
        confirmAcceptedTaskReady: async () => ({ ready: true }),
        loadReviewableChunks: async () => [{ id: "chunk-1" }],
        verifyChunk: async ({ chunkId }) => {
          calls.push(`verify:${chunkId}`);
        },
        triggerEmbedding: async ({ chunkId }) => {
          calls.push(`embed:${chunkId}`);
          return { ok: false, error: "pipeline_embedding_unavailable" };
        },
        retrieveForQuestion: async () => {
          calls.push("retrieve");
          return { chunks: [] };
        },
        answerQuestion: async () => {
          calls.push("answer");
          return { answerId: "answer-1", citationCount: 0 };
        },
      },
    });

    expect(calls).toEqual(["verify:chunk-1", "embed:chunk-1"]);
    expect(result).toMatchObject({
      ok: false,
      failedStep: "trigger_embedding",
      sourceDocumentId: "doc-1",
      taskId: "task-1",
      reason: "pipeline_embedding_unavailable",
    });
    expect(result.trace.at(-1)).toEqual({
      step: "trigger_embedding",
      status: "failed",
      reason: "pipeline_embedding_unavailable",
      targetId: "chunk-1",
    });
  });
});
