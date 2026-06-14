// lib/knowledge/conversation-history.ts
// 从已持久化 Answer 记录还原最近 N 轮上下文，供 Standalone Query 使用。

import { prisma } from "@/lib/db/client";
import type { ConversationTurn } from "@/types/knowledge";

type PersistedAnswer = {
  original_question: string;
  answer_text: string | null;
};

export interface ConversationHistoryStore {
  answer: {
    findMany(input: {
      where: {
        conversation_id: string;
        status: "COMPLETED";
        answer_text: { not: null };
      };
      orderBy: { started_at: "desc" };
      take: number;
      select: {
        original_question: true;
        answer_text: true;
      };
    }): Promise<PersistedAnswer[]>;
  };
}

export async function loadConversationHistory(
  store: ConversationHistoryStore = prisma,
  conversationId: string,
  options: { maxTurns?: number } = {},
): Promise<ConversationTurn[]> {
  const maxTurns = options.maxTurns ?? 10;
  const maxAnswers = Math.max(1, Math.ceil(maxTurns / 2));

  const answersNewestFirst = await store.answer.findMany({
    where: {
      conversation_id: conversationId,
      status: "COMPLETED",
      answer_text: { not: null },
    },
    orderBy: { started_at: "desc" },
    take: maxAnswers,
    select: {
      original_question: true,
      answer_text: true,
    },
  });

  return answersNewestFirst
    .filter((answer): answer is { original_question: string; answer_text: string } =>
      Boolean(answer.answer_text),
    )
    .reverse()
    .flatMap((answer) => [
      { role: "user" as const, content: answer.original_question },
      { role: "assistant" as const, content: answer.answer_text },
    ])
    .slice(-maxTurns);
}

export async function resolveConversationHistory(
  store: ConversationHistoryStore = prisma,
  conversationId: string,
  fallbackHistory: ConversationTurn[] = [],
  options: { maxTurns?: number } = {},
): Promise<ConversationTurn[]> {
  const persistedHistory = await loadConversationHistory(
    store,
    conversationId,
    options,
  );
  return persistedHistory.length > 0
    ? persistedHistory
    : fallbackHistory.slice(-(options.maxTurns ?? 10));
}
