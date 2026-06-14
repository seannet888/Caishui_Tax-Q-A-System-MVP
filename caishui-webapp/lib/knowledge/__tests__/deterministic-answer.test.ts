import { describe, expect, it } from "vitest";
import { persistDeterministicAnswer } from "@/lib/knowledge/deterministic-answer";

describe("persistDeterministicAnswer", () => {
  it("将零证据模板回答保存为已完成答案且不创建引用", async () => {
    const created: unknown[] = [];
    const store = {
      answer: {
        create: async (input: unknown) => {
          created.push(input);
          return { id: "answer-deterministic-1" };
        },
      },
    };

    const result = await persistDeterministicAnswer(store, {
      conversationId: "conversation-1",
      originalQuestion: "有没有出台配套细则？",
      retrievalQuery: "有没有出台配套细则？",
      contextSnapshot: [{ role: "user", content: "上一轮问题" }],
      answerText: "当前知识库未收录到与您问题相关的文件。",
      reason: "no_evidence",
      coverageEvidence: {
        sourcesHit: [],
        dateRange: {},
        documentTypesHit: [],
        globalSourceHealth: [],
      },
    });

    expect(result).toEqual({ id: "answer-deterministic-1" });
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      data: {
        conversation_id: "conversation-1",
        original_question: "有没有出台配套细则？",
        retrieval_query: "有没有出台配套细则？",
        context_snapshot: [{ role: "user", content: "上一轮问题" }],
        status: "COMPLETED",
        answer_text: "当前知识库未收录到与您问题相关的文件。",
        model: "deterministic-template",
        coverage_evidence_snapshot: {
          sourcesHit: [],
          dateRange: {},
          documentTypesHit: [],
          globalSourceHealth: [],
          deterministicAnswerReason: "no_evidence",
        },
      },
    });
    expect((created[0] as { data: { completed_at?: Date } }).data.completed_at).toBeInstanceOf(Date);
  });
});
