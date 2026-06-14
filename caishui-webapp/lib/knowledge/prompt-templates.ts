// lib/knowledge/prompt-templates.ts
// 财税专用 Prompt 模板（含时效性提示、覆盖证据、最新政策与管辖地约束）。

import dayjs from "dayjs";
import type { QueryPlan, RetrievedEvidence } from "@/types/knowledge";
import { formatGlobalCoverage, GLOBAL_COVERAGE } from "@/lib/knowledge/coverage";
import {
  formatRetrievalCoverageEvidence,
  type RetrievalCoverageEvidence,
} from "@/lib/knowledge/coverage-evidence";
import { formatQueryPlan } from "@/lib/knowledge/query-plan";

export const PROMPT_TEMPLATE_VERSION =
  process.env.PROMPT_TEMPLATE_VERSION ?? "v1.1";

export const LATEST_POLICY_RULES = `
当用户询问「最新政策」「最近政策」等模糊时间表述时，默认解释为当前有效且生效日期最新的规范性文件或可执行条款。
当用户指定管辖地时，先按管辖地匹配筛选或分组，再在组内按当前有效、生效日期和效力层级排序；无本地文件时才退回全国性文件并说明限制。
如果用户明确询问「最新发布」，按发布日期排序，但必须标注材料是否已失效或尚未生效。
如果只命中官方解读，必须说明未找到对应规范性原文，以下内容为官方解读。
如果只命中授权性条款，不能回答具体政策内容；应说明授权内容，并提示当前检索证据未包含对应配套文件。
回答涉及「最新」时，必须说明排序规则和本次检索覆盖证据中的来源、日期范围。
`;

export const JURISDICTION_GUIDANCE = `
当用户没有指定任何地域时，请优先引用全国性法规或国家级文件，不要根据用户所在地推断税务管辖地。
如果问题明显与地方政策相关（如社保费率、地方教育费附加、城镇土地使用税、房产税等），请主动提示用户提供地区：「不同地区的标准可能不同，请问您需要了解哪个地区的政策？」
如果检索结果中只有地方性文件，而用户没有说明该地区，必须明确说明「以下信息基于【地区】文件，全国性规定未命中；如您不在该地区，请结合当地实际」。
当用户问题中明确提到地域（如「上海」「广东省」）时，请优先参考该地域的专门文件。
如果同时存在国家级文件和地方文件，需要分别引用，并说明两者关系：国家级文件通常是上位依据，地方文件通常是本地执行口径或适用说明。
如果未找到本地专门文件，必须说明「当前检索结果未包含该地专门文件，以下为全国性政策，地方可能另有规定」。
如果材料看起来存在差异，不要自行裁判冲突；提示可能存在差异，并建议以高层级规范和主管税务机关确认为准。
`;

function describeEffectivity(chunk: RetrievedEvidence): string {
  const now = dayjs();
  if (chunk.effective_date && dayjs(chunk.effective_date).isAfter(now)) {
    return "尚未生效";
  }
  if (chunk.expire_date && !dayjs(chunk.expire_date).isAfter(now)) {
    return "已失效";
  }
  return "当前有效或未记录失效日期";
}

export function buildTaxPrompt(
  chunks: RetrievedEvidence[],
  query: string,
  coverageEvidence: RetrievalCoverageEvidence,
  queryPlan?: QueryPlan,
): string {
  const expiringChunks = chunks.filter((c) => {
    if (!c.expire_date) return false;
    const daysLeft = dayjs(c.expire_date).diff(dayjs(), "day");
    return daysLeft >= 0 && daysLeft <= 30;
  });

  const expiryWarning =
    expiringChunks.length > 0
      ? `\n注意：部分参考资料将于 ${expiringChunks[0]!.expire_date} 前后失效，建议核对最新政策。`
      : "";

  return `你是一位专业的财税顾问。请基于以下检索到的法规内容回答用户问题。

重要约束：
1. 只使用提供的参考资料回答，不得凭记忆引用法规条文
2. 如果参考资料中没有明确答案，不得回答「尚未出台」「还未发布」「不存在」等绝对性表述
3. 当检索不到配套文件或具体条款时，必须说明「当前知识库未收录到相关文件/条款」，并提示该信息可能已发布但未被收录
4. 引用法规时必须标注文号和生效日期${expiryWarning}
5. 必须使用参考资料编号格式「[1]」「[2]」标注依据；每个事实性结论句末都必须至少包含一个引用标记
6. 引用标记必须对应下方「参考资料」中的编号，不得引用不存在的编号，也不得只写文号而省略「[n]」

${LATEST_POLICY_RULES}

${JURISDICTION_GUIDANCE}

${queryPlan?.effectivityLabelRequired ? "本次检索计划要求逐条标明材料是当前有效、尚未生效还是已失效。" : ""}

参考资料：
${chunks
  .map(
    (c, i) =>
      `[${i + 1}] 分支：${c.retrieval_execution} | 来源：${c.doc_number ?? "未知文号"} | 标题：${c.title} | 发布：${c.publish_date ?? "未知"} | 生效：${c.effective_date ?? "未知"} | 失效：${c.expire_date ?? "未记录"} | 状态：${describeEffectivity(c)}\n${c.content}`,
  )
  .join("\n\n")}

全局覆盖范围：
${formatGlobalCoverage(GLOBAL_COVERAGE)}

本次检索覆盖证据：
${formatRetrievalCoverageEvidence(coverageEvidence)}

${queryPlan ? `本次检索计划：\n${formatQueryPlan(queryPlan)}` : ""}

用户问题：${query}`;
}
