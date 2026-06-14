// POST /api/chunks/[chunkId]/verify — reviewer 人工核验 chunk。

import { NextRequest, NextResponse } from "next/server";
import { verifyChunkHuman } from "@/lib/knowledge/chunk-review";
import {
  domainErrorResponse,
  readJsonBody,
  resolveActorFromRequest,
} from "@/lib/knowledge/admin-action-adapter";
import { triggerChunkEmbedding } from "@/lib/pipeline/embedding-trigger";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: { chunkId: string } },
) {
  const actor = resolveActorFromRequest(request);
  const { notes } = await readJsonBody<{ notes?: string }>(request);

  try {
    await verifyChunkHuman(params.chunkId, actor, notes ?? "");
    const embedding = await triggerChunkEmbedding(params.chunkId, actor);
    return NextResponse.json({ ok: true, embedding });
  } catch (err) {
    return domainErrorResponse(err);
  }
}
