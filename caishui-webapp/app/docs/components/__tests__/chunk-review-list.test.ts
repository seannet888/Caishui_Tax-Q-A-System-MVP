import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChunkReviewList } from "../ChunkReviewList";

describe("ChunkReviewList", () => {
  it("renders chunk readiness, metadata, and verification audit details", () => {
    const html = renderToStaticMarkup(
      createElement(ChunkReviewList, {
        pagination: {
          chunkPage: 1,
          chunkPageSize: 50,
          chunkTotal: 2,
          chunkPageCount: 1,
        },
        chunks: [
          {
            id: "chunk-ready",
            index: 1,
            type: "text",
            content: "第一条 可检索内容。",
            contentHash:
              "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            verificationStatus: "verified",
            verificationMethod: "human",
            verificationNotes: "依据官网原文核验",
            verifiedBy: "reviewer-1",
            verifiedAt: new Date("2026-06-14T00:00:00.000Z"),
            embeddingStatus: "COMPLETED",
            retrievalStatus: "RETRIEVABLE",
            effectiveDate: new Date("2026-01-01T00:00:00.000Z"),
            expireDate: null,
            articleNumber: "第一条",
            canReview: false,
            retrievalReadiness: "ready",
            readinessMessage: null,
            canRetryEmbedding: false,
          },
          {
            id: "chunk-blocked",
            index: 2,
            type: "text",
            content: "第二条 尚未完成向量化。",
            contentHash:
              "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            verificationStatus: "verified",
            verificationMethod: "seed",
            verificationNotes: null,
            verifiedBy: null,
            verifiedAt: null,
            embeddingStatus: "FAILED",
            retrievalStatus: "RETRIEVABLE",
            effectiveDate: null,
            expireDate: null,
            articleNumber: null,
            canReview: false,
            retrievalReadiness: "blocked",
            readinessMessage: "已核验，但 embedding 尚未完成，默认检索不会召回该 chunk",
            canRetryEmbedding: false,
          },
        ],
      }),
    );

    expect(html).toContain("Chunk 审阅");
    expect(html).toContain("第 1 / 1 页，共 2 个");
    expect(html).toContain("Chunk 1");
    expect(html).toContain("可检索");
    expect(html).toContain("核验方式：human");
    expect(html).toContain("核验人：reviewer-1");
    expect(html).toContain("备注：依据官网原文核验");
    expect(html).toContain("Chunk 2");
    expect(html).toContain("检索阻塞");
    expect(html).toContain("已核验，但 embedding 尚未完成");
    expect(html).toContain("bg-white");
  });
});
