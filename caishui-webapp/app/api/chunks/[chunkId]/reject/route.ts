// POST /api/chunks/[chunkId]/reject — reviewer 拒绝低质量 chunk。

import { NextRequest, NextResponse } from "next/server";
import { rejectChunk } from "@/lib/knowledge/chunk-review";
import {
  domainErrorResponse,
  readJsonBody,
  resolveActorFromRequest,
} from "@/lib/knowledge/admin-action-adapter";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: { chunkId: string } },
) {
  const actor = resolveActorFromRequest(request);
  const { reason } = await readJsonBody<{ reason?: string }>(request);

  try {
    await rejectChunk(params.chunkId, actor, reason ?? "");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return domainErrorResponse(err);
  }
}
