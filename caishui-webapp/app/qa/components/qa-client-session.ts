"use client";

import { useCallback, useEffect, useState } from "react";
import { selectLatestAssistantCitations } from "./citation-rail-presenter";
import { getBrowserConversationId } from "./conversation-identity";
import { parseChatStreamEvents } from "./chat-sse-protocol";
import {
  appendQueuedTurn,
  applyChatStreamEvent,
  markLastAssistantFailed,
  toConversationHistory,
} from "./qa-page-view-model";
import {
  hydrateMessagesFromAnswerHistory,
  mergeCompletedAnswerHydration,
  type QaMessage,
} from "./history-hydration";
import type { AnswerHistoryResponse, ChatStreamEvent } from "@/types/api";

export interface QaClientSession {
  messages: QaMessage[];
  busy: boolean;
  ready: boolean;
  latestCitations: ReturnType<typeof selectLatestAssistantCitations>;
  send(question: string): Promise<void>;
}

export interface ChatRequestBody {
  conversationId: string;
  question: string;
  history: ReturnType<typeof toConversationHistory>;
}

export function useQaClientSession(): QaClientSession {
  const [messages, setMessages] = useState<QaMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  useEffect(() => {
    setConversationId(getBrowserConversationId());
  }, []);

  useEffect(() => {
    if (!conversationId) return;
    let cancelled = false;
    async function hydrateHistory() {
      try {
        const res = await fetch(
          `/api/conversations/${conversationId}/answers?limit=50`,
        );
        if (!res.ok) return;
        const body = (await res.json()) as AnswerHistoryResponse;
        if (cancelled) return;
        const hydratedMessages = hydrateMessagesFromAnswerHistory(body.answers);
        setMessages((current) =>
          shouldApplyHydratedMessages(current, hydratedMessages)
            ? hydratedMessages
            : current,
        );
      } catch {
        // 历史加载失败不阻断新提问；下一次刷新可再次尝试。
      }
    }
    void hydrateHistory();
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  const send = useCallback(
    async (question: string) => {
      if (!conversationId) return;
      setBusy(true);
      const requestBody = buildChatRequestBody({
        conversationId,
        question,
        messages,
      });
      setMessages((prev) => appendQueuedTurn(prev, question));

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });
        if (!res.body) throw new Error("no_stream");

        for await (const evt of parseChatStreamEvents(res.body)) {
          applyEvent(evt, setMessages);
          if (evt.type === "done") {
            await refreshCompletedAnswer({
              conversationId,
              answerId: evt.answerId,
              setMessages,
            });
          }
        }
      } catch {
        setMessages((prev) => markLastAssistantFailed(prev));
      } finally {
        setBusy(false);
      }
    },
    [conversationId, messages],
  );

  return {
    messages,
    busy,
    ready: Boolean(conversationId),
    latestCitations: selectLatestAssistantCitations(messages),
    send,
  };
}

export function shouldApplyHydratedMessages(
  current: QaMessage[],
  hydrated: QaMessage[],
): boolean {
  return current.length === 0 && hydrated.length > 0;
}

export function buildChatRequestBody(input: {
  conversationId: string;
  question: string;
  messages: QaMessage[];
}): ChatRequestBody {
  return {
    conversationId: input.conversationId,
    question: input.question,
    history: toConversationHistory(input.messages),
  };
}

function applyEvent(
  evt: ChatStreamEvent,
  setMessages: React.Dispatch<React.SetStateAction<QaMessage[]>>,
) {
  setMessages((prev) => applyChatStreamEvent(prev, evt));
}

async function refreshCompletedAnswer(input: {
  conversationId: string;
  answerId: string;
  setMessages: React.Dispatch<React.SetStateAction<QaMessage[]>>;
}) {
  try {
    const res = await fetch(
      `/api/conversations/${input.conversationId}/answers?limit=50`,
    );
    if (!res.ok) return;
    const body = (await res.json()) as AnswerHistoryResponse;
    const hydratedMessages = hydrateMessagesFromAnswerHistory(body.answers);
    input.setMessages((current) =>
      mergeCompletedAnswerHydration(current, hydratedMessages, input.answerId),
    );
  } catch {
    // History hydration is a read-model polish step; generation already completed.
  }
}
