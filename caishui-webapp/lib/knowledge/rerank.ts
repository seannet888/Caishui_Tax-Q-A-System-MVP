// lib/knowledge/rerank.ts
// 权威性二次排序：向量召回 top-30 后在应用层重排取 top-5。
// 指定管辖地时先分组（本地 vs 其他），本地优先但保留上位依据补充。
// MVP 不使用 Cross-Encoder / LLM reranker。

import type {
  LatestIntent,
  RetrievedEvidence,
  RetrievalRankingMode,
} from "@/types/knowledge";

export const LOCAL_SENSITIVE_KEYWORDS = [
  "社保费率",
  "社保缴费比例",
  "地方教育费附加",
  "地方水利建设基金",
  "城镇土地使用税",
  "房产税",
  "地方附加税",
];

export function hasLocalSensitiveKeyword(query: string): boolean {
  return LOCAL_SENSITIVE_KEYWORDS.some((kw) => query.includes(kw));
}

export function groupByJurisdiction(
  chunks: RetrievedEvidence[],
  queryJurisdiction?: string,
): { local: RetrievedEvidence[]; others: RetrievedEvidence[] } {
  if (!queryJurisdiction) return { local: [], others: chunks };
  return {
    local: chunks.filter((c) => c.jurisdiction?.includes(queryJurisdiction)),
    others: chunks.filter((c) => !c.jurisdiction?.includes(queryJurisdiction)),
  };
}

export function scoreChunk(
  chunk: RetrievedEvidence,
  rankingMode: RetrievalRankingMode = "effective_date",
): number {
  const now = Date.now();
  const authorityScore = (chunk.authority_rank ?? 50) / 100;
  const rankingDate =
    rankingMode === "publish_date" ? chunk.publish_date : chunk.effective_date;
  const effectiveTime = rankingDate
    ? new Date(rankingDate).getTime()
    : 0;
  const recencyScore =
    effectiveTime > 0
      ? Math.max(0, 1 - (now - effectiveTime) / (1000 * 60 * 60 * 24 * 365 * 10))
      : 0.5;

  return chunk.similarity * 0.55 + authorityScore * 0.3 + recencyScore * 0.15;
}

export function detectLatestIntent(query: string): LatestIntent {
  if (/最新(发布|出台)|最近发布/.test(query)) return "latest_publication";
  if (/最新(解读|答疑)|最近解读/.test(query)) return "latest_interpretation";
  if (/(有没有|是否).*(出台|制定|发布)|配套.*(办法|细则)/.test(query))
    return "rule_status";
  return "current_effective_policy";
}

export function rerankByAuthority(
  chunks: RetrievedEvidence[],
  queryJurisdiction?: string,
  rankingMode: RetrievalRankingMode = "effective_date",
  strictDateOrdering = false,
): RetrievedEvidence[] {
  const sortWithinGroup = (items: RetrievedEvidence[]) => {
    const scored = items.map((chunk) => ({
      ...chunk,
      rerank_score: scoreChunk(chunk, rankingMode),
    }));
    if (strictDateOrdering) {
      const dateOf = (chunk: RetrievedEvidence) =>
        new Date(
          rankingMode === "publish_date"
            ? chunk.publish_date ?? 0
            : chunk.effective_date ?? 0,
        ).getTime();
      return scored.sort(
        (a, b) =>
          dateOf(b) - dateOf(a) ||
          (b.rerank_score ?? 0) - (a.rerank_score ?? 0),
      );
    }
    return scored.sort(
      (a, b) => (b.rerank_score ?? 0) - (a.rerank_score ?? 0),
    );
  };

  if (!queryJurisdiction) {
    const nationwide = chunks.filter(
      (chunk) => !chunk.jurisdiction || chunk.jurisdiction === "全国",
    );
    const local = chunks.filter(
      (chunk) => chunk.jurisdiction && chunk.jurisdiction !== "全国",
    );
    return [...sortWithinGroup(nationwide), ...sortWithinGroup(local)];
  }

  const { local, others } = groupByJurisdiction(chunks, queryJurisdiction);
  const rankedLocal = sortWithinGroup(local);
  const rankedOthers = sortWithinGroup(others);
  // 本地材料优先，但保留全国性或其他上位依据作为补充。
  return [...rankedLocal.slice(0, 3), ...rankedOthers.slice(0, 2)];
}
