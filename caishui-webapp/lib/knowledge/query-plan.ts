// 纯逻辑 Query Planning Module。
// 将用户问题解释为可审计的检索执行计划；不依赖 Prisma，也不生成 SQL。

import type {
  QueryPlan,
  RetrievalExecution,
} from "@/types/knowledge";
import { detectLatestIntent } from "@/lib/knowledge/rerank";
import { detectTemporalIntent, parseQueryDate } from "@/lib/knowledge/temporal";

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function extractYear(query: string): number | undefined {
  const match = query.match(/(?:在|截至|截止|到|比较|相比)?\s*(20\d{2})年/);
  return match ? Number(match[1]) : undefined;
}

function yearEnd(year: number): string {
  return `${year}-12-31`;
}

function yearStart(year: number): string {
  return `${year}-01-01`;
}

function currentExecution(): RetrievalExecution {
  return { id: "primary", temporalScope: "current" };
}

export function buildQueryPlan(input: {
  query: string;
  jurisdiction?: string;
  queryDate?: string;
}): QueryPlan {
  const temporalIntent = detectTemporalIntent(input.query);
  const latestIntent = detectLatestIntent(input.query);
  const explicitDate = input.queryDate
    ? toIsoDate(parseQueryDate(input.queryDate))
    : undefined;
  const year = extractYear(input.query);

  let executions: RetrievalExecution[];
  let rankingMode: QueryPlan["rankingMode"] = "effective_date";
  let effectivityLabelRequired = false;
  let strictDateOrdering =
    /(最新|最近).*(政策|规定|文件)|现行有效|当前适用/.test(input.query);
  let docTypeFilter: QueryPlan["docTypeFilter"];

  // Latest Intent 只在与时间门控明确交互时覆盖默认 Temporal Intent。
  //
  // ⚠️ 设计决策：「latest_publication」使用 temporalScope="unbounded"，不按 effective_date/expire_date 过滤。
  // 语义是按 publish_date 排序，允许已失效/尚未生效的文件进入候选（用户问"最近发布了什么"应看到所有最新出版的文件）。
  // 安全性由 effectivityLabelRequired=true 保证：Prompt 层强制 LLM 逐条标注状态，不得将已失效材料当作现行有效引用。
  // 参见：temporal.ts 中 unbounded 分支注释，prompt-templates.ts 的 describeEffectivity。
  if (latestIntent === "latest_publication") {
    executions = [{ id: "primary", temporalScope: "unbounded" }];
    rankingMode = "publish_date";
    effectivityLabelRequired = true;
    strictDateOrdering = true;
  } else if (temporalIntent === "historical_comparison") {
    const historicalDate = explicitDate ?? (year ? yearEnd(year) : undefined);
    if (!historicalDate) {
      throw new Error("historical_comparison_requires_query_date");
    }
    executions = [
      { id: "historical", temporalScope: "as_of", asOf: historicalDate },
      { id: "current", temporalScope: "current" },
    ];
  } else if (temporalIntent === "publication_period") {
    if (!year) {
      throw new Error("publication_period_requires_year");
    }
    executions = [
      {
        id: "primary",
        temporalScope: "publication_period",
        publicationStart: yearStart(year),
        publicationEnd: yearEnd(year),
      },
    ];
    rankingMode = "publish_date";
    effectivityLabelRequired = true;
    strictDateOrdering = true;
  } else if (temporalIntent === "as_of") {
    const asOf = explicitDate ?? (year ? yearEnd(year) : undefined);
    if (!asOf) throw new Error("as_of_query_requires_valid_date");
    executions = [{ id: "primary", temporalScope: "as_of", asOf }];
  } else {
    executions = [currentExecution()];
  }

  if (latestIntent === "latest_interpretation") {
    docTypeFilter = "interpretation";
    rankingMode = "publish_date";
    strictDateOrdering = true;
  }

  return {
    temporalIntent,
    latestIntent,
    executions,
    rankingMode,
    jurisdiction: input.jurisdiction,
    docTypeFilter,
    effectivityLabelRequired,
    strictDateOrdering,
  };
}

export function formatQueryPlan(plan: QueryPlan): string {
  const executionText = plan.executions
    .map((execution) => {
      if (execution.temporalScope === "as_of") {
        return `${execution.id}:截至 ${execution.asOf} 有效`;
      }
      if (execution.temporalScope === "publication_period") {
        return `${execution.id}:发布日期 ${execution.publicationStart} 至 ${execution.publicationEnd}`;
      }
      if (execution.temporalScope === "unbounded") {
        return `${execution.id}:不按失效日期排除`;
      }
      return `${execution.id}:当前有效`;
    })
    .join("；");

  return [
    `时间意图：${plan.temporalIntent}`,
    `最新意图：${plan.latestIntent}`,
    `执行：${executionText}`,
    `排序：${plan.rankingMode}`,
    `严格日期优先：${plan.strictDateOrdering ? "是" : "否"}`,
  ].join("\n");
}
