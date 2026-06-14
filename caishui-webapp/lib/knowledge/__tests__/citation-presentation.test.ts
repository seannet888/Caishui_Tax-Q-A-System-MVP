import { describe, expect, it } from "vitest";
import { presentCitation } from "@/lib/knowledge/citation-presentation";
import type { CitationSnapshot } from "@/types/knowledge";

function snapshot(partial: Partial<CitationSnapshot> = {}): CitationSnapshot {
  return {
    chunkId: "chunk-1",
    chunkContentHash: "hash-1",
    docNumber: "财税〔2024〕1号",
    title: "测试文件",
    evidenceExcerpt: "这是回答时提供给模型的证据片段。",
    isTruncated: false,
    includesTable: false,
    tableTruncated: false,
    sourceDocumentName: "source.pdf",
    answeredAt: "2026-06-11T00:00:00.000Z",
    ...partial,
  };
}

describe("presentCitation", () => {
  it("来源撤出注解会将引用标记为警告但保留快照证据", () => {
    const presented = presentCitation({
      id: "citation-1",
      snapshot: snapshot(),
      annotations: [
        {
          annotation_type: "source_withdrawn",
          message: "该引用来源已从当前知识库中撤出：来源文件解析错误",
          resolved_at: null,
        },
      ],
    });

    expect(presented.status).toBe("withdrawn");
    expect(presented.severity).toBe("warning");
    expect(presented.badges).toEqual(["来源已撤出"]);
    expect(presented.warnings).toEqual([
      "该引用来源已从当前知识库中撤出：来源文件解析错误",
    ]);
    expect(presented.evidenceExcerpt).toBe("这是回答时提供给模型的证据片段。");
    expect(presented.snapshotContentHash).toBe("hash-1");
  });

  it("内容错误注解优先于来源撤出并标记为危险", () => {
    const presented = presentCitation({
      id: "citation-1",
      snapshot: snapshot(),
      annotations: [
        {
          annotation_type: "source_withdrawn",
          message: "该引用来源已从当前知识库中撤出。",
          resolved_at: null,
        },
        {
          annotation_type: "content_error",
          message: "该引用内容已被标记为可能错误，请勿作为决策依据。",
          resolved_at: null,
        },
      ],
    });

    expect(presented.status).toBe("content_error");
    expect(presented.severity).toBe("danger");
    expect(presented.badges).toEqual(["内容可能错误"]);
    expect(presented.warnings).toEqual([
      "该引用来源已从当前知识库中撤出。",
      "该引用内容已被标记为可能错误，请勿作为决策依据。",
    ]);
  });
});
