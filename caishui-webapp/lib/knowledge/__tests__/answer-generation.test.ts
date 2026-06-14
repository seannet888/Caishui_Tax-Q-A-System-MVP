import { describe, expect, it } from "vitest";
import {
  generateAnswerEvents,
  type AnswerGenerationDependencies,
} from "@/lib/knowledge/answer-generation";
import type {
  QueryPlan,
  RetrievedEvidence,
} from "@/types/knowledge";

const evidence: RetrievedEvidence = {
  id: "c" + "1".repeat(24),
  document_id: "doc-1",
  content: "第一条 研发费用可以按规定加计扣除。",
  content_hash: "a".repeat(64),
  chunk_type: "text",
  similarity: 0.92,
  distance: 0.08,
  title: "研发费用加计扣除政策",
  source_document_name: "研发费用政策.pdf",
  doc_number: "财税〔2023〕6号",
  publish_date: "2023-03-01T00:00:00.000Z",
  effective_date: "2023-01-01T00:00:00.000Z",
  jurisdiction: "全国",
  source_channel: "财政部官网",
  doc_type: "notice",
  provision_type: "operative",
  retrieval_execution: "primary",
};

const queryPlan: QueryPlan = {
  temporalIntent: "current_applicability",
  latestIntent: "current_effective_policy",
  executions: [{ id: "primary", temporalScope: "current" }],
      rankingMode: "effective_date",
      effectivityLabelRequired: false,
      strictDateOrdering: false,
};

function createHarness() {
  const completed: Array<{
    answerId: string;
    answerText: string;
    evidence: RetrievedEvidence[];
  }> = [];

  const dependencies: AnswerGenerationDependencies = {
    getQueueSize: () => 0,
    startAnswer: async () => ({ id: "answer-1" }),
    appendDraft: async () => {},
    finalizeAnswer: async (answerId, answerText, usedEvidence) => {
      completed.push({ answerId, answerText, evidence: usedEvidence });
      return { status: "completed" };
    },
    failAnswer: async () => {},
    streamModel: async function* () {
      yield "依据财税〔2023〕6号";
      yield "，研发费用可以加计扣除[1]。";
      return "upstream_done";
    },
  };

  return { dependencies, completed };
}

describe("generateAnswerEvents", () => {
  it("模型正常结束后提交正式答案与实际引用快照", async () => {
    const harness = createHarness();
    const events = [];

    for await (const event of generateAnswerEvents(
      {
        conversationId: "conversation-1",
        originalQuestion: "研发费用能否加计扣除？",
        retrievalQuery: "研发费用加计扣除当前适用政策",
        contextSnapshot: [],
        chunks: [evidence],
        coverageEvidence: {
          sourcesHit: ["财政部官网"],
          dateRange: { min: "2023-03-01", max: "2023-03-01" },
          documentTypesHit: ["notice"],
          globalSourceHealth: [],
        },
        queryPlan,
        evidenceState: "SUFFICIENT_EVIDENCE",
      },
      harness.dependencies,
    )) {
      events.push(event);
    }

    expect(events).toEqual([
      { type: "queued", position: 0 },
      { type: "start" },
      { type: "token", delta: "依据财税〔2023〕6号" },
      { type: "token", delta: "，研发费用可以加计扣除[1]。" },
      { type: "done", answerId: "answer-1" },
    ]);
    expect(harness.completed).toHaveLength(1);
    expect(harness.completed[0]?.answerText).toBe(
      "依据财税〔2023〕6号，研发费用可以加计扣除[1]。",
    );
    expect(harness.completed[0]?.evidence).toEqual([evidence]);
  });

  it("流式草稿按批次写入，并在最终提交前强制 flush 最新草稿", async () => {
    const drafts: string[] = [];
    const finalized: string[] = [];
    const dependencies: AnswerGenerationDependencies = {
      getQueueSize: () => 0,
      startAnswer: async () => ({ id: "answer-batched-draft" }),
      appendDraft: async (_answerId, draftText) => {
        drafts.push(draftText);
      },
      finalizeAnswer: async (_answerId, answerText) => {
        finalized.push(answerText);
        return { status: "completed" };
      },
      failAnswer: async () => {},
      streamModel: async function* () {
        for (let i = 0; i < 25; i += 1) {
          yield "字";
        }
        yield "[1]";
        return "upstream_done";
      },
    };

    for await (const _event of generateAnswerEvents(
      {
        conversationId: "conversation-1",
        originalQuestion: "研发费用能否加计扣除？",
        retrievalQuery: "研发费用加计扣除当前适用政策",
        contextSnapshot: [],
        chunks: [evidence],
        coverageEvidence: {
          sourcesHit: ["财政部官网"],
          dateRange: {},
          documentTypesHit: ["notice"],
          globalSourceHealth: [],
        },
        queryPlan,
        evidenceState: "SUFFICIENT_EVIDENCE",
      },
      dependencies,
    )) {
      // Consume all events.
    }

    expect(drafts).toEqual(["字".repeat(20), `${"字".repeat(25)}[1]`]);
    expect(finalized).toEqual([`${"字".repeat(25)}[1]`]);
  });

  it("客户端停止消费时中止模型并保留失败草稿", async () => {
    let modelSignal: AbortSignal | undefined;
    const failures: Array<{ errorCode: string; errorMessage: string }> = [];
    const completed: unknown[] = [];
    const dependencies: AnswerGenerationDependencies = {
      getQueueSize: () => 0,
      startAnswer: async () => ({ id: "answer-disconnected" }),
      appendDraft: async () => {},
      finalizeAnswer: async (...args) => {
        completed.push(args);
        return { status: "completed" };
      },
      failAnswer: async (_answerId, failure) => {
        failures.push(failure);
      },
      streamModel: async function* (_prompt, signal) {
        modelSignal = signal;
        yield "尚未完成的草稿";
        await new Promise<void>(() => {});
      },
    };

    const events = generateAnswerEvents(
      {
        conversationId: "conversation-1",
        originalQuestion: "研发费用能否加计扣除？",
        retrievalQuery: "研发费用加计扣除当前适用政策",
        contextSnapshot: [],
        chunks: [evidence],
        coverageEvidence: {
          sourcesHit: ["财政部官网"],
          dateRange: {},
          documentTypesHit: ["notice"],
          globalSourceHealth: [],
        },
        queryPlan,
        evidenceState: "SUFFICIENT_EVIDENCE",
      },
      dependencies,
    );

    await events.next(); // queued
    await events.next(); // start
    await events.next(); // first token
    await events.return(undefined);

    expect(modelSignal?.aborted).toBe(true);
    expect(failures).toEqual([
      {
        errorCode: "client_disconnected",
        errorMessage: "client disconnected before model completion",
      },
    ]);
    expect(completed).toHaveLength(0);
  });

  it("模型流中断时记录上游失败而不是客户端断连", async () => {
    const failures: Array<{ errorCode: string; errorMessage: string }> = [];
    const dependencies: AnswerGenerationDependencies = {
      getQueueSize: () => 0,
      startAnswer: async () => ({ id: "answer-upstream-failed" }),
      appendDraft: async () => {},
      finalizeAnswer: async () => ({ status: "completed" }),
      failAnswer: async (_answerId, failure) => {
        failures.push(failure);
      },
      streamModel: async function* () {
        yield "部分草稿";
        throw new Error("socket closed");
      },
    };
    const events = [];

    for await (const event of generateAnswerEvents(
      {
        conversationId: "conversation-1",
        originalQuestion: "研发费用能否加计扣除？",
        retrievalQuery: "研发费用加计扣除当前适用政策",
        contextSnapshot: [],
        chunks: [evidence],
        coverageEvidence: {
          sourcesHit: ["财政部官网"],
          dateRange: {},
          documentTypesHit: ["notice"],
          globalSourceHealth: [],
        },
        queryPlan,
        evidenceState: "SUFFICIENT_EVIDENCE",
      },
      dependencies,
    )) {
      events.push(event);
    }

    expect(events.at(-1)).toEqual({
      type: "error",
      code: "upstream_stream_interrupted",
      message: "模型响应中断，请重试。",
    });
    expect(failures).toEqual([
      {
        errorCode: "upstream_stream_interrupted",
        errorMessage: "Error: socket closed",
      },
    ]);
  });

  it("模型流静默结束但没有完成证明时不得进入 Finalization", async () => {
    const failures: Array<{ errorCode: string; errorMessage: string }> = [];
    const finalized: unknown[] = [];
    const dependencies: AnswerGenerationDependencies = {
      getQueueSize: () => 0,
      startAnswer: async () => ({ id: "answer-incomplete" }),
      appendDraft: async () => {},
      finalizeAnswer: async (...args) => {
        finalized.push(args);
        return { status: "completed" };
      },
      failAnswer: async (_answerId, failure) => {
        failures.push(failure);
      },
      streamModel: async function* () {
        yield "残缺答案";
      },
    };

    const events = [];
    for await (const event of generateAnswerEvents(
      {
        conversationId: "conversation-1",
        originalQuestion: "研发费用能否加计扣除？",
        retrievalQuery: "研发费用加计扣除当前适用政策",
        contextSnapshot: [],
        chunks: [evidence],
        coverageEvidence: {
          sourcesHit: ["财政部官网"],
          dateRange: {},
          documentTypesHit: ["notice"],
          globalSourceHealth: [],
        },
        queryPlan,
        evidenceState: "SUFFICIENT_EVIDENCE",
      },
      dependencies,
    )) {
      events.push(event);
    }

    expect(finalized).toHaveLength(0);
    expect(failures).toEqual([
      {
        errorCode: "upstream_stream_incomplete",
        errorMessage: "model stream ended without upstream completion proof",
      },
    ]);
    expect(events.at(-1)).toEqual({
      type: "error",
      code: "upstream_stream_incomplete",
      message: "模型响应未完整结束，请重试。",
    });
  });

  it("最终事务失败时记录 persistence_error 并返回错误事件", async () => {
    const failures: Array<{ errorCode: string; errorMessage: string }> = [];
    const dependencies: AnswerGenerationDependencies = {
      getQueueSize: () => 0,
      startAnswer: async () => ({ id: "answer-persistence-failed" }),
      appendDraft: async () => {},
      finalizeAnswer: async () => {
        throw new Error("database unavailable");
      },
      failAnswer: async (_answerId, failure) => {
        failures.push(failure);
      },
      streamModel: async function* () {
        yield "依据财税〔2023〕6号[1]。";
        return "upstream_done";
      },
    };
    const events = [];

    for await (const event of generateAnswerEvents(
      {
        conversationId: "conversation-1",
        originalQuestion: "研发费用能否加计扣除？",
        retrievalQuery: "研发费用加计扣除当前适用政策",
        contextSnapshot: [],
        chunks: [evidence],
        coverageEvidence: {
          sourcesHit: ["财政部官网"],
          dateRange: {},
          documentTypesHit: ["notice"],
          globalSourceHealth: [],
        },
        queryPlan,
        evidenceState: "SUFFICIENT_EVIDENCE",
      },
      dependencies,
    )) {
      events.push(event);
    }

    expect(events.at(-1)).toEqual({
      type: "error",
      code: "persistence_error",
      message: "答案保存失败，请重试。",
    });
    expect(failures).toEqual([
      {
        errorCode: "persistence_error",
        errorMessage: "Error: database unavailable",
      },
    ]);
  });

  it("客户端 AbortSignal 可中止正在等待下一 token 的模型流", async () => {
    const clientAbort = new AbortController();
    const failures: Array<{ errorCode: string; errorMessage: string }> = [];
    let firstTokenDelivered: (() => void) | undefined;
    const firstToken = new Promise<void>((resolve) => {
      firstTokenDelivered = resolve;
    });
    const dependencies: AnswerGenerationDependencies = {
      getQueueSize: () => 0,
      startAnswer: async () => ({ id: "answer-signal-disconnected" }),
      appendDraft: async () => {},
      finalizeAnswer: async () => ({ status: "completed" }),
      failAnswer: async (_answerId, failure) => {
        failures.push(failure);
      },
      streamModel: async function* (_prompt, signal) {
        yield "第一个 token";
        firstTokenDelivered?.();
        await new Promise<void>((_resolve, reject) => {
          signal.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        });
      },
    };
    const events = generateAnswerEvents(
      {
        conversationId: "conversation-1",
        originalQuestion: "研发费用能否加计扣除？",
        retrievalQuery: "研发费用加计扣除当前适用政策",
        contextSnapshot: [],
        chunks: [evidence],
        coverageEvidence: {
          sourcesHit: ["财政部官网"],
          dateRange: {},
          documentTypesHit: ["notice"],
          globalSourceHealth: [],
        },
        queryPlan,
        evidenceState: "SUFFICIENT_EVIDENCE",
        clientSignal: clientAbort.signal,
      },
      dependencies,
    );

    const consuming = (async () => {
      for await (const _event of events) {
        // 消费到流自然结束。
      }
    })();
    await firstToken;
    clientAbort.abort();
    await consuming;

    expect(failures).toEqual([
      {
        errorCode: "client_disconnected",
        errorMessage: "client disconnected before model completion",
      },
    ]);
  });

  it("Grounding 失败时不发布 done 事件", async () => {
    const harness = createHarness();
    harness.dependencies.finalizeAnswer = async () => ({
      status: "failed",
      errorCode: "grounding_failed",
    });
    const events = [];

    for await (const event of generateAnswerEvents(
      {
        conversationId: "conversation-1",
        originalQuestion: "研发费用能否加计扣除？",
        retrievalQuery: "研发费用加计扣除当前适用政策",
        contextSnapshot: [],
        chunks: [evidence],
        coverageEvidence: {
          sourcesHit: ["财政部官网"],
          dateRange: {},
          documentTypesHit: ["notice"],
          globalSourceHealth: [],
        },
        queryPlan,
        evidenceState: "SUFFICIENT_EVIDENCE",
      },
      harness.dependencies,
    )) {
      events.push(event);
    }

    expect(events.some((event) => event.type === "done")).toBe(false);
    expect(events.at(-1)).toEqual({
      type: "error",
      code: "grounding_failed",
      message: "答案生成未通过内部一致性检查，请重试。",
    });
  });

  it("有限证据声明被注入模型 Prompt", async () => {
    let receivedPrompt = "";
    const harness = createHarness();
    harness.dependencies.streamModel = async function* (prompt) {
      receivedPrompt = prompt;
      yield "基于有限材料，结论如下[1]。";
      return "upstream_done";
    };

    for await (const _event of generateAnswerEvents(
      {
        conversationId: "conversation-1",
        originalQuestion: "研发费用能否加计扣除？",
        retrievalQuery: "研发费用加计扣除当前适用政策",
        contextSnapshot: [],
        chunks: [evidence],
        coverageEvidence: {
          sourcesHit: ["财政部官网"],
          dateRange: {},
          documentTypesHit: ["notice"],
          globalSourceHealth: [],
        },
        queryPlan,
        evidenceState: "LIMITED_EVIDENCE",
      },
      harness.dependencies,
    )) {
      // 消费完整生成过程。
    }

    expect(receivedPrompt).toContain("以下回答仅基于有限的已核验材料");
    expect(receivedPrompt).toContain("不得补充资料之外的税率、期限、条件或结论");
  });

  it("证据政策指令会进入模型 Prompt", async () => {
    let receivedPrompt = "";
    const harness = createHarness();
    harness.dependencies.streamModel = async function* (prompt) {
      receivedPrompt = prompt;
      yield "根据授权性条款，具体办法需另行制定[1]。";
      return "upstream_done";
    };

    for await (const _event of generateAnswerEvents(
      {
        conversationId: "conversation-1",
        originalQuestion: "具体办法是什么？",
        retrievalQuery: "具体办法是什么？",
        contextSnapshot: [],
        chunks: [evidence],
        coverageEvidence: {
          sourcesHit: ["财政部官网"],
          dateRange: {},
          documentTypesHit: ["notice"],
          globalSourceHealth: [],
        },
        queryPlan,
        evidenceState: "LIMITED_EVIDENCE",
        promptDirectives: ["必须说明当前检索证据未包含对应配套文件。"],
      },
      harness.dependencies,
    )) {
      // 消费完整生成过程。
    }

    expect(receivedPrompt).toContain(
      "必须说明当前检索证据未包含对应配套文件。",
    );
  });
});
