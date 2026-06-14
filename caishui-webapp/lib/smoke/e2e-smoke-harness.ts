import type { Actor } from "@/lib/auth/actor";
import { getErrorMessage } from "@/lib/utils/error";

export type SmokeStepName =
  | "upload_source"
  | "accepted_task_readiness"
  | "load_reviewable_chunks"
  | "human_verify_chunk"
  | "trigger_embedding"
  | "retrieve_question"
  | "answer_question";

export interface SmokeTraceEntry {
  step: SmokeStepName;
  status: "passed" | "failed";
  targetId?: string;
  reason?: string;
}

export interface E2ESmokeHarnessInput {
  actor: Actor;
  source: {
    fileName: string;
    bytes: Buffer;
    title: string;
    sourceChannel: string;
  };
  question: string;
  steps: {
    uploadSource(input: {
      actor: Actor;
      source: E2ESmokeHarnessInput["source"];
    }): Promise<{ sourceDocumentId: string; taskId: string }>;
    confirmAcceptedTaskReady(input: {
      actor: Actor;
      sourceDocumentId: string;
      taskId: string;
    }): Promise<{ ready: boolean; reason?: string }>;
    loadReviewableChunks(input: {
      actor: Actor;
      sourceDocumentId: string;
    }): Promise<Array<{ id: string }>>;
    verifyChunk(input: { actor: Actor; chunkId: string }): Promise<void>;
    triggerEmbedding(input: {
      actor: Actor;
      chunkId: string;
    }): Promise<{ ok: boolean; error?: string }>;
    retrieveForQuestion(input: {
      actor: Actor;
      question: string;
      sourceDocumentId: string;
      taskId: string;
      verifiedChunkIds: string[];
    }): Promise<{ chunks: Array<{ id: string }> }>;
    answerQuestion(input: {
      actor: Actor;
      question: string;
      chunkIds: string[];
    }): Promise<{ answerId: string; citationCount: number }>;
  };
}

export type E2ESmokeHarnessResult =
  | {
      ok: true;
      sourceDocumentId: string;
      taskId: string;
      verifiedChunkIds: string[];
      answerId: string;
      citationCount: number;
      trace: SmokeTraceEntry[];
    }
  | {
      ok: false;
      failedStep: SmokeStepName;
      sourceDocumentId?: string;
      taskId?: string;
      reason: string;
      trace: SmokeTraceEntry[];
    };

export async function runE2ESmokeHarness(
  input: E2ESmokeHarnessInput,
): Promise<E2ESmokeHarnessResult> {
  const trace: SmokeTraceEntry[] = [];

  const uploaded = await attemptStep(
    "upload_source",
    trace,
    undefined,
    undefined,
    () =>
      input.steps.uploadSource({
        actor: input.actor,
        source: input.source,
      }),
  );
  if (!uploaded.ok) return uploaded.result;
  trace.push({ step: "upload_source", status: "passed" });

  const readiness = await attemptStep(
    "accepted_task_readiness",
    trace,
    uploaded.value,
    undefined,
    () =>
      input.steps.confirmAcceptedTaskReady({
        actor: input.actor,
        sourceDocumentId: uploaded.value.sourceDocumentId,
        taskId: uploaded.value.taskId,
      }),
  );
  if (!readiness.ok) return readiness.result;
  if (!readiness.value.ready) {
    return fail(trace, "accepted_task_readiness", readiness.value.reason ?? "not_ready", uploaded.value);
  }
  trace.push({ step: "accepted_task_readiness", status: "passed" });

  const reviewableChunks = await attemptStep(
    "load_reviewable_chunks",
    trace,
    uploaded.value,
    undefined,
    () =>
      input.steps.loadReviewableChunks({
        actor: input.actor,
        sourceDocumentId: uploaded.value.sourceDocumentId,
      }),
  );
  if (!reviewableChunks.ok) return reviewableChunks.result;
  trace.push({ step: "load_reviewable_chunks", status: "passed" });

  const verifiedChunkIds: string[] = [];
  for (const chunk of reviewableChunks.value) {
    const verified = await attemptStep(
      "human_verify_chunk",
      trace,
      uploaded.value,
      chunk.id,
      () => input.steps.verifyChunk({ actor: input.actor, chunkId: chunk.id }),
    );
    if (!verified.ok) return verified.result;
    verifiedChunkIds.push(chunk.id);
    trace.push({
      step: "human_verify_chunk",
      status: "passed",
      targetId: chunk.id,
    });

    const embedding = await attemptStep(
      "trigger_embedding",
      trace,
      uploaded.value,
      chunk.id,
      () =>
        input.steps.triggerEmbedding({
          actor: input.actor,
          chunkId: chunk.id,
        }),
    );
    if (!embedding.ok) return embedding.result;
    if (!embedding.value.ok) {
      return fail(
        trace,
        "trigger_embedding",
        embedding.value.error ?? "embedding_trigger_failed",
        uploaded.value,
        chunk.id,
      );
    }
    trace.push({
      step: "trigger_embedding",
      status: "passed",
      targetId: chunk.id,
    });
  }

  const retrieval = await attemptStep(
    "retrieve_question",
    trace,
    uploaded.value,
    undefined,
    () =>
      input.steps.retrieveForQuestion({
        actor: input.actor,
        question: input.question,
        sourceDocumentId: uploaded.value.sourceDocumentId,
        taskId: uploaded.value.taskId,
        verifiedChunkIds,
      }),
  );
  if (!retrieval.ok) return retrieval.result;
  trace.push({ step: "retrieve_question", status: "passed" });

  const answered = await attemptStep(
    "answer_question",
    trace,
    uploaded.value,
    undefined,
    () =>
      input.steps.answerQuestion({
        actor: input.actor,
        question: input.question,
        chunkIds: retrieval.value.chunks.map((chunk) => chunk.id),
      }),
  );
  if (!answered.ok) return answered.result;
  trace.push({ step: "answer_question", status: "passed" });

  return {
    ok: true,
    sourceDocumentId: uploaded.value.sourceDocumentId,
    taskId: uploaded.value.taskId,
    verifiedChunkIds,
    answerId: answered.value.answerId,
    citationCount: answered.value.citationCount,
    trace,
  };
}

async function attemptStep<T>(
  failedStep: SmokeStepName,
  trace: SmokeTraceEntry[],
  uploaded: { sourceDocumentId: string; taskId: string } | undefined,
  targetId: string | undefined,
  run: () => Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false; result: E2ESmokeHarnessResult }> {
  try {
    return { ok: true, value: await run() };
  } catch (error) {
    return {
      ok: false,
      result: fail(trace, failedStep, getErrorMessage(error), uploaded, targetId),
    };
  }
}

function fail(
  trace: SmokeTraceEntry[],
  failedStep: SmokeStepName,
  reason: string,
  uploaded?: { sourceDocumentId: string; taskId: string },
  targetId?: string,
): E2ESmokeHarnessResult {
  trace.push({ step: failedStep, status: "failed", reason, targetId });
  return {
    ok: false,
    failedStep,
    sourceDocumentId: uploaded?.sourceDocumentId,
    taskId: uploaded?.taskId,
    reason,
    trace,
  };
}
