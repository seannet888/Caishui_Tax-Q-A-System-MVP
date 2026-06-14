// app/api/documents/route.ts
// GET /api/documents — 文档列表（服务端分页）。

import { NextRequest, NextResponse } from "next/server";
import { listDocuments } from "@/lib/db/queries/documents";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const { page, pageSize: take } = parsePaginationParams(searchParams);
  const { items, total } = await listDocuments({ skip: (page - 1) * take, take });
  return NextResponse.json({ items, total, page, pageSize: take });
}

function parsePaginationParams(searchParams: URLSearchParams): {
  page: number;
  pageSize: number;
} {
  return {
    page: parsePositiveInt(searchParams.get("page"), 1, Number.MAX_SAFE_INTEGER),
    pageSize: parsePositiveInt(searchParams.get("pageSize"), 20, 100),
  };
}

function parsePositiveInt(
  raw: string | null,
  defaultValue: number,
  max: number,
): number {
  const parsed = Number(raw ?? defaultValue);
  if (!Number.isFinite(parsed) || parsed < 1) return defaultValue;
  return Math.min(max, Math.trunc(parsed));
}
