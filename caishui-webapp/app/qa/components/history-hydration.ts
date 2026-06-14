import type { AnswerHistoryItem } from "@/types/api";
import type { PresentedCitation } from "@/lib/knowledge/citation-presentation";
import { presentHistoricalAssistantAnswer } from "./answer-display-presenter";

export interface QaMessage {
  role: "user" | "assistant";
  content: string;
  status?: "streaming" | "completed" | "failed" | "queued";
  citations?: PresentedCitation[];
  meta?: QaMessageMeta;
}

export interface QaMessageMeta {
  answerId: string;
  model: string;
  promptTemplateVersion: string;
  retrievalQuery: string | null;
  deterministicReason?: AnswerHistoryItem["deterministicReason"];
  startedAt: string;
  completedAt: string | null;
  failedAt?: string | null;
}

export function hydrateMessagesFromAnswerHistory(
  answers: AnswerHistoryItem[],
): QaMessage[] {
  return answers.flatMap((answer) => {
    const assistant = presentHistoricalAssistantAnswer(answer);
    return [
      {
        role: "user" as const,
        content: answer.originalQuestion,
        status: "completed" as const,
      },
      {
        role: "assistant" as const,
        content: assistant.content,
        status: assistant.status,
        citations: answer.citations,
        meta: {
          answerId: answer.id,
          model: answer.model,
          promptTemplateVersion: answer.promptTemplateVersion,
          retrievalQuery: answer.retrievalQuery,
          deterministicReason: answer.deterministicReason,
          startedAt: answer.startedAt,
          completedAt: answer.completedAt,
          failedAt: answer.failedAt,
        },
      },
    ];
  });
}

export function mergeCompletedAnswerHydration(
  current: QaMessage[],
  hydrated: QaMessage[],
  answerId: string,
): QaMessage[] {
  const replacement = hydrated.find(
    (message) =>
      message.role === "assistant" && message.meta?.answerId === answerId,
  );
  if (!replacement) return current;

  const replaceIndex = findCurrentAssistantIndex(current, answerId);
  if (replaceIndex < 0) return current;

  const next = [...current];
  next[replaceIndex] = replacement;
  return next;
}

function findCurrentAssistantIndex(
  messages: QaMessage[],
  answerId: string,
): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== "assistant") continue;
    if (!message.meta?.answerId || message.meta.answerId === answerId) {
      return index;
    }
    return -1;
  }
  return -1;
}
