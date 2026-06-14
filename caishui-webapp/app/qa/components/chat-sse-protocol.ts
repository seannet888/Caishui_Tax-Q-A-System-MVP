import type { ChatStreamEvent } from "@/types/api";

export class ChatSseProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChatSseProtocolError";
  }
}

export async function* parseChatStreamEvents(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<ChatStreamEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const event = parseSseFrame(frame);
      if (event) yield event;
    }
  }

  const tail = buffer + decoder.decode();
  if (tail.trim()) {
    const event = parseSseFrame(tail);
    if (event) yield event;
  }
}

function parseSseFrame(frame: string): ChatStreamEvent | null {
  const dataLines = frame
    .split(/\r?\n/u)
    .map((line) => line.trimEnd())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.replace(/^data:\s?/u, ""));

  if (!dataLines.length) return null;
  const payload = dataLines.join("\n").trim();
  if (!payload) return null;

  try {
    return JSON.parse(payload) as ChatStreamEvent;
  } catch (error) {
    throw new ChatSseProtocolError(`invalid_chat_sse_payload:${String(error)}`);
  }
}
