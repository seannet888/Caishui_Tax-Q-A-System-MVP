// lib/knowledge/temporal.ts
// 时间意图路由 + 参数化时效过滤。
// ⚠️ 不得仅因问题包含早于当前年份的年份就移除时效过滤；年份可能是文号、发布日期、适用期间或比较对象。

import { Prisma } from "@prisma/client";
import type { RetrievalExecution, TemporalIntent } from "@/types/knowledge";

export function detectTemporalIntent(query: string): TemporalIntent {
  if (
    /(现在|目前|当前|现行|还|是否).*(有效|适用|执行)|现在.*(是否|还).*(有效|适用)/.test(
      query,
    )
  ) {
    return "current_validity";
  }
  if (/(变化|变更|调整|对比|相比|以前.*现在|原来.*现在|旧.*新)/.test(query)) {
    return "historical_comparison";
  }
  if (
    /(发布|出台|颁布|印发).*(哪些|什么|文件|政策)|(\d{4})年.*(发布|出台|颁布|印发)/.test(
      query,
    )
  ) {
    return "publication_period";
  }
  if (
    /(在|截至|截止|到).*(\d{4})年.*(适用|执行|税率|规定)|(\d{4})年.*(适用|执行|税率是多少|怎么缴)/.test(
      query,
    )
  ) {
    return "as_of";
  }
  return "current_applicability";
}

export function parseQueryDate(input: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    throw new Error("invalid_query_date_format");
  }
  const date = new Date(`${input}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== input
  ) {
    throw new Error("invalid_query_date");
  }
  return date;
}

/** 将纯逻辑 Retrieval Execution 翻译为参数化 SQL。 */
export function buildExecutionFilter(
  execution: RetrievalExecution,
): Prisma.Sql {
  switch (execution.temporalScope) {
    case "current":
      return Prisma.sql`
        AND (kc.effective_date IS NULL OR kc.effective_date <= NOW())
        AND (kc.expire_date IS NULL OR kc.expire_date > NOW())
      `;
    case "as_of": {
      const asOf = parseQueryDate(execution.asOf);
      return Prisma.sql`
        AND (kc.effective_date IS NULL OR kc.effective_date <= ${asOf})
        AND (kc.expire_date IS NULL OR kc.expire_date > ${asOf})
      `;
    }
    case "publication_period": {
      const start = parseQueryDate(execution.publicationStart);
      const end = parseQueryDate(execution.publicationEnd);
      return Prisma.sql`
        AND kc.publish_date >= ${start}
        AND kc.publish_date <= ${end}
      `;
    }
    case "unbounded":
      // ⚠️ 设计决策（非 bug）：「unbounded」不按 effective_date/expire_date 过滤。
      // 用于 latestIntent === "latest_publication"（用户问"最新发布了什么"）场景。
      // 其语义是"按发布日期排序，允许已失效/尚未生效的文件进入候选"。
      // 安全性由 queryPlan.effectivityLabelRequired=true 保证：Prompt 层要求 LLM 逐条标注状态。
      // 参见：query-plan.ts 的 latest_publication 分支，prompt-templates.ts 的 describeEffectivity。
      return Prisma.empty;
  }
}
