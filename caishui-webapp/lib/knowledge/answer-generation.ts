// Answer Generation Module：从已检索证据生成流事件，并管理 Answer Draft 到正式答案的提交。

import type { ChatStreamEvent } from "@/types/api";
import type {
  EvidenceSufficiency,
  QueryPlan,
  RetrievedEvidence,
} from "@/types/knowledge";
import type { RetrievalCoverageEvidence } from "@/lib/knowledge/coverage-evidence";
import { buildTaxPrompt } from "@/lib/knowledge/prompt-templates";
import { LIMITED_EVIDENCE_PROMPT } from "@/lib/knowledge/evidence";

const DRAFT_FLUSH_TOKEN_INTERVAL = 20;

export interface AnswerGenerationInput {
  conversationId: string;
  originalQuestion: string;
  retrievalQuery: string;
  contextSnapshot: unknown;
  chunks: RetrievedEvidence[];
  coverageEvidence: RetrievalCoverageEvidence;
  queryPlan: QueryPlan;
  evidenceState: Exclude<EvidenceSufficiency, "NO_EVIDENCE">;
  promptDirectives?: string[];
  clientSignal?: AbortSignal;
}

export interface AnswerGenerationDependencies {
  getQueueSize(): number;
  startAnswer(input: {
    conversationId: string;
    originalQuestion: string;
    retrievalQuery: string;
    contextSnapshot: unknown;
    model: string;
    coverageEvidence: RetrievalCoverageEvidence;
  }): Promise<{ id: string }>;
  appendDraft(answerId: string, draftText: string): Promise<void>;
  finalizeAnswer(
    answerId: string,
    answerText: string,
    evidence: RetrievedEvidence[],
  ): Promise<{ status: "completed" } | { status: "failed"; errorCode: string }>;
  failAnswer(
    answerId: string,
    input: { errorCode: string; errorMessage: string },
  ): Promise<void>;
  streamModel(
    prompt: string,
    signal: AbortSignal,
  ): AsyncGenerator<string, "upstream_done" | void>;
}

export async function* generateAnswerEvents(
  input: AnswerGenerationInput,
  dependencies: AnswerGenerationDependencies,
): AsyncGenerator<ChatStreamEvent> {
  const answer = await dependencies.startAnswer({
    conversationId: input.conversationId,
    originalQuestion: input.originalQuestion,
    retrievalQuery: input.retrievalQuery,
    contextSnapshot: input.contextSnapshot,
    model: "deepseek-chat",
    coverageEvidence: input.coverageEvidence,
  });
  const abortController = new AbortController();
  const abortForClientDisconnect = () => abortController.abort();
  if (input.clientSignal?.aborted) {
    abortController.abort();
  } else {
    input.clientSignal?.addEventListener(
      "abort",
      abortForClientDisconnect,
      { once: true },
    );
  }
  const basePrompt = buildTaxPrompt(
    input.chunks,
    input.retrievalQuery,
    input.coverageEvidence,
    input.queryPlan,
  );
  const policyPrompt = input.promptDirectives?.length
    ? `证据政策强制指令：\n${input.promptDirectives.join("\n")}\n\n`
    : "";
  const prompt =
    input.evidenceState === "LIMITED_EVIDENCE"
      ? `${policyPrompt}${LIMITED_EVIDENCE_PROMPT}\n\n${basePrompt}`
      : `${policyPrompt}${basePrompt}`;

  yield { type: "queued", position: dependencies.getQueueSize() };
  yield { type: "start" };

  let answerText = "";
  let tokensSinceDraftFlush = 0;
  let lastDraftFlushText = "";
  let modelCompleted = false;
  let modelFailed = false;
  const flushDraft = async () => {
    if (answerText === lastDraftFlushText) return;
    await dependencies.appendDraft(answer.id, answerText);
    lastDraftFlushText = answerText;
    tokensSinceDraftFlush = 0;
  };
  try {
    const modelStream = dependencies.streamModel(
      prompt,
      abortController.signal,
    );
    while (true) {
      const next = await modelStream.next();
      if (next.done) {
        if (next.value !== "upstream_done") {
          modelFailed = true;
          await dependencies.failAnswer(answer.id, {
            errorCode: "upstream_stream_incomplete",
            errorMessage: "model stream ended without upstream completion proof",
          });
          yield {
            type: "error",
            code: "upstream_stream_incomplete",
            message: "模型响应未完整结束，请重试。",
          };
          return;
        }
        break;
      }
      const delta = next.value;
      answerText += delta;
      tokensSinceDraftFlush += 1;
      if (tokensSinceDraftFlush >= DRAFT_FLUSH_TOKEN_INTERVAL) {
        await flushDraft();
      }
      yield { type: "token", delta };
    }
    await flushDraft();
    modelCompleted = true;
  } catch (error) {
    modelFailed = true;
    abortController.abort();
    await flushDraft();
    if (input.clientSignal?.aborted) {
      await dependencies.failAnswer(answer.id, {
        errorCode: "client_disconnected",
        errorMessage: "client disconnected before model completion",
      });
    } else {
      await dependencies.failAnswer(answer.id, {
        errorCode: "upstream_stream_interrupted",
        errorMessage: String(error),
      });
      yield {
        type: "error",
        code: "upstream_stream_interrupted",
        message: "模型响应中断，请重试。",
      };
    }
    return;
  } finally {
    input.clientSignal?.removeEventListener(
      "abort",
      abortForClientDisconnect,
    );
    if (!modelCompleted && !modelFailed) {
      abortController.abort();
      await flushDraft();
      await dependencies.failAnswer(answer.id, {
        errorCode: "client_disconnected",
        errorMessage: "client disconnected before model completion",
      });
    }
  }

  // 模型已正常结束，之后即使客户端断开也必须完成原子提交。
  let completion:
    | { status: "completed" }
    | { status: "failed"; errorCode: string };
  try {
    completion = await dependencies.finalizeAnswer(
      answer.id,
      answerText,
      input.chunks,
    );
  } catch (error) {
    await dependencies.failAnswer(answer.id, {
      errorCode: "persistence_error",
      errorMessage: String(error),
    });
    yield {
      type: "error",
      code: "persistence_error",
      message: "答案保存失败，请重试。",
    };
    return;
  }
  if (completion.status === "failed") {
    yield {
      type: "error",
      code: completion.errorCode,
      message: "答案生成未通过内部一致性检查，请重试。",
    };
    return;
  }

  yield { type: "done", answerId: answer.id };
}
