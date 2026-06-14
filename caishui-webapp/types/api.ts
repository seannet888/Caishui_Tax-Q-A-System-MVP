// caishui-webapp/types/api.ts
// API 响应类型。

import type { ConversationTurn } from "./knowledge";
import type { PresentedCitation } from "@/lib/knowledge/citation-presentation";

export interface ChatRequest {
  conversationId: string;
  question: string;
  history?: ConversationTurn[];
  jurisdiction?: string;
  queryDate?: string; // YYYY-MM-DD，as_of 查询用
}

// SSE 事件类型（/api/chat 流式协议）
export type ChatStreamEvent =
  | { type: "queued"; position: number }
  | { type: "start" }
  | { type: "token"; delta: string }
  | { type: "done"; answerId: string }
  | { type: "needs_clarification"; question: string }
  | { type: "no_evidence"; message: string }
  | { type: "error"; code: string; message: string };

export interface ApiError {
  code: string;
  message: string;
}

export interface AnswerHistoryItem {
  id: string;
  conversationId: string;
  originalQuestion: string;
  retrievalQuery: string | null;
  answerText: string;
  status: "COMPLETED" | "FAILED";
  model: string;
  promptTemplateVersion: string;
  deterministicReason?: "needs_clarification" | "no_evidence";
  startedAt: string;
  completedAt: string | null;
  failedAt?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  citations: PresentedCitation[];
}

export interface AnswerHistoryResponse {
  answers: AnswerHistoryItem[];
}
