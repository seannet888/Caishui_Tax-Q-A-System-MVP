import { describe, expect, it } from "vitest";
import {
  ChatSseProtocolError,
  parseChatStreamEvents,
} from "@/app/qa/components/chat-sse-protocol";

function streamFromChunks(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

async function collectEvents(stream: ReadableStream<Uint8Array>) {
  const events = [];
  for await (const event of parseChatStreamEvents(stream)) {
    events.push(event);
  }
  return events;
}

describe("parseChatStreamEvents", () => {
  it("parses multiple SSE events from one network chunk", async () => {
    await expect(
      collectEvents(
        streamFromChunks([
          'data: {"type":"start"}\n\ndata: {"type":"token","delta":"财税"}\n\n',
        ]),
      ),
    ).resolves.toEqual([
      { type: "start" },
      { type: "token", delta: "财税" },
    ]);
  });

  it("parses one JSON event split across multiple network chunks", async () => {
    await expect(
      collectEvents(
        streamFromChunks([
          'data: {"type":"token",',
          '"delta":"研发费用"}\n\n',
          'data: {"type":"done","answerId":"answer-1"}\n\n',
        ]),
      ),
    ).resolves.toEqual([
      { type: "token", delta: "研发费用" },
      { type: "done", answerId: "answer-1" },
    ]);
  });

  it("ignores comments, empty lines, and non-data lines", async () => {
    await expect(
      collectEvents(
        streamFromChunks([
          ': keep-alive\n',
          'event: message\n',
          '\n',
          'data: {"type":"queued","position":2}\n\n',
        ]),
      ),
    ).resolves.toEqual([{ type: "queued", position: 2 }]);
  });

  it("throws a protocol error for invalid JSON payloads", async () => {
    await expect(
      collectEvents(streamFromChunks(["data: {not-json}\n\n"])),
    ).rejects.toBeInstanceOf(ChatSseProtocolError);
  });
});
