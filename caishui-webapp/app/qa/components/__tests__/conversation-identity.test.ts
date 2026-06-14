import { describe, expect, it } from "vitest";
import {
  CONVERSATION_ID_STORAGE_KEY,
  getOrCreateConversationId,
} from "@/app/qa/components/conversation-identity";

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

describe("getOrCreateConversationId", () => {
  it("复用 localStorage 中已有的 conversationId", () => {
    const storage = memoryStorage({
      [CONVERSATION_ID_STORAGE_KEY]: "conversation-existing",
    });

    expect(
      getOrCreateConversationId({
        storage,
        createId: () => "conversation-new",
      }),
    ).toBe("conversation-existing");
  });

  it("没有已有 conversationId 时创建并保存", () => {
    const storage = memoryStorage();

    expect(
      getOrCreateConversationId({
        storage,
        createId: () => "conversation-new",
      }),
    ).toBe("conversation-new");
    expect(storage.getItem(CONVERSATION_ID_STORAGE_KEY)).toBe("conversation-new");
  });

  it("localStorage 不可用时仍返回新 conversationId", () => {
    const brokenStorage = {
      getItem: () => {
        throw new Error("storage_blocked");
      },
      setItem: () => {
        throw new Error("storage_blocked");
      },
    };

    expect(
      getOrCreateConversationId({
        storage: brokenStorage,
        createId: () => "conversation-fallback",
      }),
    ).toBe("conversation-fallback");
  });
});
