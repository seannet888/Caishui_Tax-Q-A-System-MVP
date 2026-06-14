// lib/knowledge/standalone-query.ts
// 多轮对话上下文处理：把当前问题补全为 Standalone Query。
// 只能补全用户已明确提供的主题/时间/管辖地/查询意图，不得添加新的税务事实。
// MVP 优先用规则 + 少量固定示例，避免额外模型调用；无法可靠恢复时要求澄清。

import type {
  ConversationTurn,
  StandaloneQueryResult,
} from "@/types/knowledge";

const CONTEXT_DEPENDENT_PATTERN =
  /^(那|这|它|上述|前面|刚才).{0,6}(呢|怎么|如何|多少|吗|呢？|呢?)|^那(.+)呢/;

// TODO: 以下抽取函数 MVP 用规则实现，待补充更完整的财税主题/管辖地词典。
function extractLastExplicitTopic(turns: ConversationTurn[]): string | undefined {
  for (let i = turns.length - 1; i >= 0; i--) {
    const t = turns[i];
    if (t?.role === "user" && t.content.length > 6 && !CONTEXT_DEPENDENT_PATTERN.test(t.content)) {
      return normalizeTopic(t.content);
    }
  }
  return undefined;
}

function extractJurisdiction(text: string): string | undefined {
  const m = text.match(/(北京|上海|天津|重庆|广东|江苏|浙江|山东|河南|四川|湖北|湖南|福建|安徽|河北|陕西|辽宁|江西|云南|广西|山西|内蒙古|黑龙江|吉林|贵州|甘肃|海南|宁夏|青海|新疆|西藏)(省|市|自治区)?/);
  if (!m) return undefined;
  return normalizeJurisdiction(m[1]!, m[2]);
}

function extractLastExplicitJurisdiction(
  turns: ConversationTurn[],
): string | undefined {
  for (let i = turns.length - 1; i >= 0; i--) {
    const j = turns[i] ? extractJurisdiction(turns[i]!.content) : undefined;
    if (j) return j;
  }
  return undefined;
}

function extractTemporalIntent(text: string): string | undefined {
  const explicitYear = text.match(/(20\d{2})年/)?.[0];
  if (explicitYear) return explicitYear;
  if (/(现在|目前|当前|现行|最新)/.test(text)) return "当前适用政策";
  return undefined;
}

function extractLastExplicitTemporalIntent(
  turns: ConversationTurn[],
): string | undefined {
  for (let i = turns.length - 1; i >= 0; i--) {
    const t = turns[i] ? extractTemporalIntent(turns[i]!.content) : undefined;
    if (t) return t;
  }
  return undefined;
}

function isContextDependentQuestion(text: string): boolean {
  return CONTEXT_DEPENDENT_PATTERN.test(text.trim());
}

function composeQuery(parts: {
  currentQuestion: string;
  topic?: string;
  jurisdiction?: string;
  temporalIntent?: string;
}): string {
  const { currentQuestion, topic, jurisdiction, temporalIntent } = parts;
  if (!isContextDependentQuestion(currentQuestion)) return currentQuestion;
  // 仅拼接已明确存在的信息，不臆造新事实。
  return [jurisdiction, topic, temporalIntent].filter(Boolean).join(" ") ||
    currentQuestion;
}

function normalizeJurisdiction(name: string, suffix?: string): string {
  if (suffix) return `${name}${suffix}`;
  if (["北京", "上海", "天津", "重庆"].includes(name)) return `${name}市`;
  if (["内蒙古", "广西", "宁夏", "新疆", "西藏"].includes(name)) {
    return `${name}自治区`;
  }
  return name;
}

function normalizeTopic(text: string): string {
  return text
    .replace(/(的)?(最新|当前|现行|目前|现在)(发布)?(适用)?(政策|规定|文件)?(是什么|有哪些|如何|怎么)?[？?]?$/u, "")
    .replace(/(是什么|有哪些|如何|怎么)[？?]?$/u, "")
    .replace(/[？?。.\s]+$/u, "")
    .trim();
}

export function generateStandaloneQuery(
  recentTurns: ConversationTurn[],
  currentQuestion: string,
): StandaloneQueryResult {
  const contextSnapshot = recentTurns.slice(-5);
  const topic = extractLastExplicitTopic(contextSnapshot);
  const jurisdiction =
    extractJurisdiction(currentQuestion) ??
    extractLastExplicitJurisdiction(contextSnapshot);
  const temporalIntent =
    extractTemporalIntent(currentQuestion) ??
    extractLastExplicitTemporalIntent(contextSnapshot);

  if (isContextDependentQuestion(currentQuestion) && !topic) {
    return {
      status: "needs_clarification",
      question: "请问您指的是哪项政策或税务事项？",
      contextSnapshot,
    };
  }

  return {
    status: "ready",
    query: composeQuery({ currentQuestion, topic, jurisdiction, temporalIntent }),
    contextSnapshot,
  };
}
