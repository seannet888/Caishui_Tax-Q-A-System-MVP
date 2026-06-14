export const CONVERSATION_ID_STORAGE_KEY = "caishui.qa.conversationId";

// MVP/local identity only: this browser-generated id is not an authorization
// boundary. Before multi-user production deployment, conversation history APIs
// must enforce server-side ownership for every conversationId.
export interface ConversationIdentityStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
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
    createId: () => crypto.randomUUID(),
  });
}
