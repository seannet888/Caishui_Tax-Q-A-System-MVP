// app/api/documents/[docId]/route.ts
// GET    /api/documents/[docId]           — 文档详情（含 chunk 分布）
// POST   /api/documents/[docId]           — 撤出检索（默认管理动作；见 withdrawSourceWithAudit）
// DELETE /api/documents/[docId]           — 受限硬删除（admin + 前置条件 + 二次确认）

import { NextRequest, NextResponse } from "next/server";
import { getDocument } from "@/lib/db/queries/documents";
import {
  restoreSourceWithAudit,
  withdrawSourceWithAudit,
} from "@/lib/knowledge/source-withdrawal";
import { hardDeleteSourceWithAudit } from "@/lib/knowledge/source-hard-delete";
import {
  domainErrorResponse,
  readJsonBody,
  resolveActorFromRequest,
} from "@/lib/knowledge/admin-action-adapter";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: { docId: string } },
) {
  const { skip, take } = readChunkPagination(new URL(request.url).searchParams);
  const doc = await getDocument(params.docId, { skip, take });
  if (!doc) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(doc);
}

function readChunkPagination(searchParams: URLSearchParams): {
  skip: number;
  take: number;
} {
  const chunkPage = normalizePositiveInt(searchParams.get("chunkPage"), 1);
  const chunkPageSize = Math.min(
    100,
    normalizePositiveInt(searchParams.get("chunkPageSize"), 50),
  );
  return {
    skip: (chunkPage - 1) * chunkPageSize,
    take: chunkPageSize,
  };
}

function normalizePositiveInt(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.floor(parsed));
}

export async function POST(
  request: NextRequest,
  { params }: { params: { docId: string } },
) {
  const actor = resolveActorFromRequest(request);
  const { action, reason } = await readJsonBody<{
    action?: "withdraw" | "restore";
    reason?: string;
  }>(request);
  try {
    if (action === "restore") {
      await restoreSourceWithAudit(params.docId, actor, reason ?? "");
    } else {
      await withdrawSourceWithAudit(params.docId, actor, reason ?? "");
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return domainErrorResponse(err);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { docId: string } },
) {
  const actor = resolveActorFromRequest(request);
  const { confirm, reason } = await readJsonBody<{
    confirm?: boolean;
    reason?: string;
  }>(request);

  try {
    await hardDeleteSourceWithAudit(params.docId, actor, {
      confirm: confirm === true,
      reason: reason ?? "",
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return domainErrorResponse(err);
  }
}
