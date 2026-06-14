import type { ChatStreamEvent } from "@/types/api";
import type { ConversationTurn } from "@/types/knowledge";
import { presentStreamError } from "./answer-display-presenter";
import type { QaMessage } from "./history-hydration";

export function toConversationHistory(messages: QaMessage[]): ConversationTurn[] {
  return messages
    .filter((m) => m.content.trim().length > 0 && isStableHistoryMessage(m))
    .map((m) => ({ role: m.role, content: m.content }))
    .slice(-10);
}

function isStableHistoryMessage(message: QaMessage): boolean {
  if (message.role === "user") return true;
  return message.status === "completed";
}

export function appendQueuedTurn(
  messages: QaMessage[],
  question: string,
): QaMessage[] {
  return [
    ...messages,
    { role: "user", content: question },
    { role: "assistant", content: "", status: "queued" },
  ];
}

export function applyChatStreamEvent(
  messages: QaMessage[],
  event: ChatStreamEvent,
): QaMessage[] {
  const next = [...messages];
  const last = next[next.length - 1];
  if (!last || last.role !== "assistant") return messages;

  switch (event.type) {
    case "queued":
      last.status = "queued";
      last.content = "当前请求较多，请稍候...";
      break;
    case "start":
      last.status = "streaming";
      last.content = "";
      break;
    case "token":
      last.content += event.delta;
      break;
    case "done":
      last.status = "completed";
      break;
    case "needs_clarification":
      last.status = "completed";
      last.content = event.question;
      break;
    case "no_evidence":
      last.status = "completed";
      last.content = event.message;
      break;
    case "error":
      Object.assign(last, presentStreamError(event));
      break;
  }

  return next;
}

export function markLastAssistantFailed(messages: QaMessage[]): QaMessage[] {
  const next = [...messages];
  const last = next[next.length - 1];
  if (last && last.role === "assistant") {
    last.status = "failed";
    last.content = "请求失败，请重试。";
  }
  return next;
}
