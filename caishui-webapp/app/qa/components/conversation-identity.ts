export const CONVERSATION_ID_STORAGE_KEY = "caishui.qa.conversationId";

// MVP/local identity only: this browser-generated id is not an authorization
// boundary. Before multi-user production deployment, conversation history APIs
// must enforce server-side ownership for every conversationId.
export interface ConversationIdentityStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function generateUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // 降级方案：基于 Date.now + 随机数生成 UUID v4 格式
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Date.now() + Math.random() * 16) % 16 | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function getOrCreateConversationId(input: {
  storage: ConversationIdentityStorage;
  createId: () => string;
}): string {
  try {
    const existing = input.storage.getItem(CONVERSATION_ID_STORAGE_KEY);
    if (existing?.trim()) return existing;
  } catch {
    return input.createId();
  }

  const next = input.createId();
  try {
    input.storage.setItem(CONVERSATION_ID_STORAGE_KEY, next);
  } catch {
    // 存储不可用时仍允许当前页面会话继续。
  }
  return next;
}

export function getBrowserConversationId(): string {
  return getOrCreateConversationId({
    storage: window.localStorage,
    createId: generateUuid,
  });
}
