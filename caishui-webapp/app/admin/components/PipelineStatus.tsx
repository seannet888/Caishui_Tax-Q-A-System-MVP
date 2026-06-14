"use client";

import { useEffect, useState } from "react";
import {
  presentPipelineStatusPayload,
  type PipelineStatusView,
} from "@/app/admin/components/pipeline-status-presenter";
import { StatusPill } from "@/components/ui/StatusPill";

export function PipelineStatus({ taskId }: { taskId: string }) {
  const [view, setView] = useState<PipelineStatusView | null>(null);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      const res = await fetch(`/api/pipeline/status?taskId=${taskId}`);
      if (!active) return;
      const nextView = presentPipelineStatusPayload(await res.json());
      setView(nextView);
      if (
        nextView.kind === "task" &&
        (nextView.status.status === "PENDING" ||
          nextView.status.status === "PROCESSING")
      ) {
        setTimeout(poll, 2000);
      }
    };
    poll();
    return () => {
      active = false;
    };
  }, [taskId]);

  if (!view) {
    return (
      <p className="rounded-lg border border-[color:var(--cs-border)] bg-white p-3 text-sm text-[color:var(--cs-muted)]">
        查询任务状态中…
      </p>
    );
  }

  if (view.kind === "error") {
    return (
      <div className="rounded-lg border border-[#f2c3c5] bg-[color:var(--cs-danger-bg)] p-3 text-sm text-[color:var(--cs-danger)]">
        清洗任务状态不可用：{view.message}
      </div>
    );
  }

  const { status } = view;

  const pct =
    status.total_chunks > 0
      ? Math.round((status.completed_chunks / status.total_chunks) * 100)
      : 0;

  return (
    <div className="rounded-xl border border-[color:var(--cs-border)] bg-white p-4 text-sm shadow-[var(--cs-shadow-sm)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-semibold text-[color:var(--cs-ink)]">任务 {taskId}</div>
        <StatusPill tone="success" className="rounded-full px-2.5 py-1 font-medium">
          {status.status}
        </StatusPill>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e7f1f7]">
        <div
          className="h-full rounded-full bg-[color:var(--cs-primary)]"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-2 text-[color:var(--cs-muted)]">
        进度：{status.completed_chunks}/{status.total_chunks}（{pct}%）
      </div>
      {status.error_message && (
        <div className="mt-2 text-[color:var(--cs-danger)]">
          错误：{status.error_message}
        </div>
      )}
    </div>
  );
}
