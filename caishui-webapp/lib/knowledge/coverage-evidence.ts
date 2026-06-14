// lib/knowledge/coverage-evidence.ts
// Retrieval Coverage Evidence：每次检索后动态生成，说明本次回答实际命中的来源、日期范围、类型与覆盖异常。
// 用户问「有没有出台」「是否存在」「最新政策」时，回答必须基于它，而不是只基于全局声明。

import type { RetrievedEvidence } from "@/types/knowledge";
import { GLOBAL_SOURCE_HEALTH } from "@/lib/knowledge/coverage";

export interface RetrievalCoverageEvidence {
  sourcesHit: string[];
  dateRange: { min?: string; max?: string };
  documentTypesHit: string[];
  globalSourceHealth: Array<{
    name: string;
    status: "active" | "stale" | "failed";
    lastSuccessfulSync: string | null;
    note?: string;
  }>;
}

export function generateRetrievalCoverageEvidence(
  chunks: RetrievedEvidence[],
  sourceHealth = GLOBAL_SOURCE_HEALTH,
): RetrievalCoverageEvidence {
  const sourcesHit = Array.from(
    new Set(
      chunks.map((c) => c.source_channel).filter((v): v is string => Boolean(v)),
    ),
  );
  const publishedDates = chunks
    .map((c) => c.publish_date)
    .filter((v): v is string => Boolean(v))
    .map((v) => v.slice(0, 10))
    .sort();
  return {
    sourcesHit,
    dateRange: {
      min: publishedDates[0],
      max: publishedDates[publishedDates.length - 1],
    },
    documentTypesHit: Array.from(
      new Set(chunks.map((c) => c.doc_type).filter((v): v is string => Boolean(v))),
    ),
    globalSourceHealth: sourceHealth.map((s) => ({ ...s })),
  };
}

export function formatRetrievalCoverageEvidence(
  evidence: RetrievalCoverageEvidence,
): string {
  const unhealthySources = evidence.globalSourceHealth.filter(
    (source) => source.status !== "active",
  );
  return [
    `命中来源：${evidence.sourcesHit.join("、") || "（无）"}`,
    `命中发布日期范围：${evidence.dateRange.min ?? "?"} 至 ${evidence.dateRange.max ?? "?"}`,
    `命中文档类型：${evidence.documentTypesHit.join("、") || "（无）"}`,
    unhealthySources.length
      ? `来源健康警告：${unhealthySources
          .map(
            (source) =>
              `${source.name}=${source.status}（最近成功同步：${source.lastSuccessfulSync ?? "未知"}）`,
          )
          .join("；")}`
      : "来源健康警告：（无）",
  ].join("\n");
}
