// POST /api/chunks/[chunkId]/embed — retry embedding trigger for a verified chunk.

import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/actor";
import {
  domainErrorResponse,
  resolveActorFromRequest,
} from "@/lib/knowledge/admin-action-adapter";
import { triggerChunkEmbedding } from "@/lib/pipeline/embedding-trigger";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: { chunkId: string } },
) {
  const actor = resolveActorFromRequest(request);

  try {
    requireRole(actor, "reviewer");
    const embedding = await triggerChunkEmbedding(params.chunkId, actor);
    return NextResponse.json({ ok: true, embedding });
  } catch (err) {
    return domainErrorResponse(err);
  }
}
