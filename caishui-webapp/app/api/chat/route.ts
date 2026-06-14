// app/api/chat/route.ts
// POST /api/chat — 流式问答薄 Adapter。
// 调用链：route → lib/knowledge/chat-turn → answer-generation → stream-handler（铁律二）。

import { NextRequest } from "next/server";
import { z } from "zod";
import { resolveActorFromRequest } from "@/lib/knowledge/admin-action-adapter";
import {
  appendDraft,
  failAnswer,
  finalizeStreamedAnswer,
  startAnswer,
} from "@/lib/knowledge/answer";
import {
  getQueueSize,
  parseDeepSeekStream,
  streamChatWithQueue,
} from "@/lib/knowledge/stream-handler";
import {
  generateAnswerEvents,
  type AnswerGenerationDependencies,
} from "@/lib/knowledge/answer-generation";
import { planChatTurn } from "@/lib/knowledge/chat-turn";
import type { ChatRequest, ChatStreamEvent } from "@/types/api";

export const runtime = "nodejs"; // 需要长连 SSE + Prisma，禁止 edge/serverless

const chatRequestSchema = z.object({
  conversationId: z.string().trim().min(1).max(100),
  question: z.string().trim().min(1).max(2_000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(4_000),
      }),
    )
    .max(10)
    .optional(),
  jurisdiction: z.string().trim().min(1).max(50).optional(),
  queryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/u)
    .optional(),
});

function sse(event: ChatStreamEvent): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
}

export async function POST(request: NextRequest) {
  const actor = resolveActorFromRequest(request);
  void actor; // viewer 即可问答；预留审计/限流用

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return Response.json({ error: "invalid_chat_request" }, { status: 400 });
  }

  const parsed = chatRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return Response.json({ error: "invalid_chat_request" }, { status: 400 });
  }
  const body: ChatRequest = parsed.data;

  const turn = await planChatTurn(body);
  if (turn.kind === "deterministic") return streamOnce(turn.event);

  const clientAbort = new AbortController();
  const dependencies: AnswerGenerationDependencies = {
    getQueueSize,
    startAnswer,
    appendDraft,
    finalizeAnswer: finalizeStreamedAnswer,
    failAnswer,
    streamModel: async function* (prompt, signal) {
      const source = await streamChatWithQueue(
        [{ role: "user", content: prompt }],
        signal,
      );
      return yield* parseDeepSeekStream(source);
    },
  };
  const events = generateAnswerEvents(
    {
      ...turn.generationInput,
      clientSignal: clientAbort.signal,
    },
    dependencies,
  );

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of events) {
          controller.enqueue(sse(event));
        }
        if (!clientAbort.signal.aborted) controller.close();
      } catch (err) {
        if (!clientAbort.signal.aborted) {
          controller.enqueue(
            sse({
              type: "error",
              code: "generation_failed",
              message: String(err),
            }),
          );
          controller.close();
        }
      }
    },
    cancel() {
      clientAbort.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

function streamOnce(event: ChatStreamEvent): Response {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(sse(event));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
