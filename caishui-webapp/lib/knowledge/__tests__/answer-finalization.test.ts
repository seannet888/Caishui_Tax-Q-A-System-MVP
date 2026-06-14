import { describe, expect, it } from "vitest";
import {
  finalizeAnswer,
  type AnswerFinalizationRepository,
} from "@/lib/knowledge/answer-finalization";
import type { CitationSnapshot, RetrievedEvidence } from "@/types/knowledge";

function evidence(id: string, docNumber: string): RetrievedEvidence {
  return {
    id,
    document_id: "doc-1",
    content: `${docNumber}规定的完整证据片段。`,
    content_hash: "a".repeat(64),
    chunk_type: "text",
    similarity: 0.9,
    distance: 0.1,
    title: `${docNumber}测试文件`,
    source_document_name: "测试文件.pdf",
    doc_number: docNumber,
    provision_type: "operative",
    retrieval_execution: "primary",
  };
}

describe("finalizeAnswer", () => {
  it("校验通过后只原子提交答案实际使用的 Citation Snapshots", async () => {
    const committed: Array<{
      answerId: string;
      answerText: string;
      citations: CitationSnapshot[];
    }> = [];
    const repository: AnswerFinalizationRepository = {
      commit: async (input) => {
        committed.push(input);
      },
      reject: async () => {
        throw new Error("不应拒绝合法答案");
      },
    };

    const result = await finalizeAnswer(
      {
        answerId: "answer-1",
        answerText: "依据财税〔2023〕6号，研发费用可按规定加计扣除[1]。",
        evidence: [
          evidence("c" + "1".repeat(24), "财税〔2023〕6号"),
          evidence("c" + "2".repeat(24), "财税〔2024〕9号"),
        ],
      },
      repository,
    );

    expect(result).toEqual({ status: "completed" });
    expect(committed).toHaveLength(1);
    expect(committed[0]?.citations).toHaveLength(1);
    expect(committed[0]?.citations[0]?.docNumber).toBe("财税〔2023〕6号");
  });

  it("Grounding 不通过时记录失败且绝不提交正式答案", async () => {
    const committed: unknown[] = [];
    const rejected: Array<{ answerId: string; errors: string[] }> = [];
    const repository: AnswerFinalizationRepository = {
      commit: async (input) => {
        committed.push(input);
      },
      reject: async (input) => {
        rejected.push(input);
      },
    };

    const result = await finalizeAnswer(
      {
        answerId: "answer-2",
        answerText: "研发费用可以按规定加计扣除。",
        evidence: [evidence("c" + "1".repeat(24), "财税〔2023〕6号")],
      },
      repository,
    );

    expect(result).toEqual({
      status: "failed",
      errorCode: "grounding_failed",
    });
    expect(committed).toHaveLength(0);
    expect(rejected).toEqual([
      { answerId: "answer-2", errors: ["missing_citation"] },
    ]);
  });
});
