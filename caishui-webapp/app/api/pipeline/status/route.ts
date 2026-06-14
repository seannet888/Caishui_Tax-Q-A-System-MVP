// app/api/pipeline/status/route.ts
// GET /api/pipeline/status?taskId=... — 透传 data-pipeline /status/{task_id} 的清洗进度。

import { NextRequest, NextResponse } from "next/server";
import { resolveActorFromRequest } from "@/lib/knowledge/admin-action-adapter";
import { getPipelineStatus } from "@/lib/pipeline/status-client";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const actor = resolveActorFromRequest(request);
  const taskId = new URL(request.url).searchParams.get("taskId");
  if (!taskId) {
    return NextResponse.json({ error: "taskId_required" }, { status: 400 });
  }
  const result = await getPipelineStatus({
    actor,
    taskId,
  });
  if (result.status === 0) {
    return NextResponse.json(
      { error: "pipeline_unavailable", detail: result.data },
      { status: 502 },
    );
  }
  return NextResponse.json(result.data, { status: result.status });
}
