import type { AnswerHistoryItem, ChatStreamEvent } from "@/types/api";
import type { QaMessage } from "./history-hydration";

const RETRIEVAL_UNAVAILABLE_MESSAGE =
  "当前检索服务暂时不可用，无法完成知识库查询。请稍后重试；如果持续出现，请检查 Embedding API 配置。";

const GROUNDING_FAILED_MESSAGE =
  "答案生成后未通过引用一致性检查，已阻止展示。请重新提问。";

const GENERIC_GENERATION_FAILED_MESSAGE =
  "答案生成未完成或未通过内部检查，请重试。";

export function presentHistoricalAssistantAnswer(
  answer: AnswerHistoryItem,
): Pick<QaMessage, "content" | "status"> {
  if (answer.status !== "FAILED") {
    return {
      content: appendDeterministicNote(answer.answerText, answer.deterministicReason),
      status: "completed",
    };
  }
  return {
    content: presentFailureMessage(answer.errorCode),
    status: "failed",
  };
}

function appendDeterministicNote(
  answerText: string,
  reason: AnswerHistoryItem["deterministicReason"],
): string {
  if (reason === "no_evidence") {
    return `${answerText}\n\n提示：这是系统在无可用检索证据时返回的确定性回答，未调用生成模型。`;
  }
  if (reason === "needs_clarification") {
    return `${answerText}\n\n提示：这是系统根据上下文不足返回的澄清问题，未调用生成模型。`;
  }
  return answerText;
}

export function presentStreamError(
  event: Extract<ChatStreamEvent, { type: "error" }>,
): Pick<QaMessage, "content" | "status"> {
  return {
    content: presentFailureMessage(event.code),
    status: "failed",
  };
}

function presentFailureMessage(errorCode: string | null | undefined): string {
  if (
    errorCode === "retrieval_unavailable" ||
    errorCode === "query_embedding_auth_failed" ||
    errorCode === "query_embedding_timeout" ||
    errorCode === "query_embedding_failed"
  ) {
    return RETRIEVAL_UNAVAILABLE_MESSAGE;
  }
  if (errorCode === "grounding_failed") return GROUNDING_FAILED_MESSAGE;
  return GENERIC_GENERATION_FAILED_MESSAGE;
}
