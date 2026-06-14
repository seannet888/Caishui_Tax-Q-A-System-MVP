// GET /api/conversations/[conversationId]/answers — 历史答案只读模型。
// 返回 Answer + Citation Presentation，不回查实时 chunk 内容。

import { NextRequest, NextResponse } from "next/server";
import { resolveActorFromRequest } from "@/lib/knowledge/admin-action-adapter";
import { loadAnswerHistory } from "@/lib/knowledge/answer-read-model";
import type { AnswerHistoryResponse } from "@/types/api";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: { conversationId: string } },
) {
  const actor = resolveActorFromRequest(request);
  // MVP/local only: viewer may read a conversation by id. Multi-user production
  // must add server-side ownership/tenant checks before returning history.
  void actor;

  const requestedLimit = Number(request.nextUrl.searchParams.get("limit") ?? 50);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(1, Math.trunc(requestedLimit)), 100)
    : 50;

  const answers = await loadAnswerHistory(
    undefined,
    params.conversationId,
    { limit },
  );
  return NextResponse.json({ answers } satisfies AnswerHistoryResponse);
}
