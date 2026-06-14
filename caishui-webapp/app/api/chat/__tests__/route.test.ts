import { describe, expect, it, vi } from "vitest";

const { planChatTurn } = vi.hoisted(() => ({
  planChatTurn: vi.fn(),
}));

vi.mock("@/lib/auth/actor", () => ({
  resolveActor: () => ({ id: "viewer-1", roles: ["viewer"] }),
}));

vi.mock("@/lib/knowledge/chat-turn", () => ({
  planChatTurn,
}));

vi.mock("@/lib/knowledge/answer", () => ({
  appendDraft: vi.fn(),
  failAnswer: vi.fn(),
  finalizeStreamedAnswer: vi.fn(),
  startAnswer: vi.fn(),
}));

vi.mock("@/lib/knowledge/stream-handler", () => ({
  getQueueSize: vi.fn(() => 0),
  parseDeepSeekStream: vi.fn(),
  streamChatWithQueue: vi.fn(),
}));

vi.mock("@/lib/knowledge/answer-generation", () => ({
  generateAnswerEvents: vi.fn(),
}));

import { POST } from "@/app/api/chat/route";

describe("POST /api/chat", () => {
  it("rejects invalid chat request bodies before planning a turn", async () => {
    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({
          conversationId: "",
          question: "",
          queryDate: "not-a-date",
        }),
      }) as never,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "invalid_chat_request",
    });
    expect(planChatTurn).not.toHaveBeenCalled();
  });
});
