import React from "react";
import { StatusPill, type StatusTone } from "@/components/ui/StatusPill";
import { cn } from "@/lib/utils/cn";
import { formatDate } from "@/lib/utils/date";
import type { QaMessageMeta } from "./history-hydration";

export function MessageBubble({
  role,
  content,
  status,
  meta,
}: {
  role: "user" | "assistant";
  content: string;
  status?: string;
  meta?: QaMessageMeta;
}) {
  const isUser = role === "user";
  return (
    <div className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#c7e2f3] bg-[#e3f2fb] text-sm font-bold text-[color:var(--cs-primary)] shadow-[var(--cs-shadow-sm)]">
          税
        </div>
      )}
      <div
        className={cn(
          "max-w-[min(84%,48rem)] rounded-xl px-4 py-3 text-sm leading-6",
          isUser
            ? "rounded-br bg-[color:var(--cs-primary-dark)] text-white shadow-[0_4px_12px_rgba(0,107,166,0.22)]"
            : "rounded-tl border border-[color:var(--cs-border)] bg-white text-[color:var(--cs-ink)] shadow-[var(--cs-shadow-sm)]",
          status === "failed" &&
            "border border-[#f2c3c5] bg-[color:var(--cs-danger-bg)] text-[color:var(--cs-danger)]",
          status === "streaming" && !isUser && "border-[color:var(--cs-cyan)]",
        )}
      >
        {!isUser && <AssistantStatusHeader status={status} meta={meta} />}
        <div className="whitespace-pre-wrap">
          {content || (status === "streaming" ? "…" : "")}
        </div>
        {!isUser && meta && <AssistantMeta meta={meta} status={status} />}
      </div>
    </div>
  );
}

function AssistantStatusHeader({
  status,
  meta,
}: {
  status?: string;
  meta?: QaMessageMeta;
}) {
  const labels = buildAssistantLabels(status, meta);
  if (labels.length === 0) return null;
  return (
    <div className="mb-2 flex flex-wrap gap-1.5">
      {labels.map((label) => (
        <StatusPill key={label.text} tone={label.tone} className="font-medium">
          {label.text}
        </StatusPill>
      ))}
    </div>
  );
}

function AssistantMeta({
  meta,
  status,
}: {
  meta: QaMessageMeta;
  status?: string;
}) {
  const time = status === "failed" ? meta.failedAt : meta.completedAt;
  return (
    <div className="mt-3 border-t border-[color:var(--cs-divider)] pt-2 text-xs leading-5 text-[color:var(--cs-muted)]">
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        <span>模型：{meta.model}</span>
        <span>Prompt：{meta.promptTemplateVersion}</span>
        {time && <span>时间：{formatDate(time)}</span>}
      </div>
      {meta.retrievalQuery && (
        <div className="mt-1 break-words">检索查询：{meta.retrievalQuery}</div>
      )}
    </div>
  );
}

function buildAssistantLabels(
  status?: string,
  meta?: QaMessageMeta,
): Array<{ text: string; tone: StatusTone }> {
  const labels: Array<{ text: string; tone: StatusTone }> = [];
  if (status === "queued") labels.push({ text: "排队中", tone: "neutral" });
  if (status === "streaming") labels.push({ text: "生成中", tone: "neutral" });
  if (status === "failed") labels.push({ text: "失败记录", tone: "danger" });
  if (meta) labels.push({ text: "历史答案", tone: "neutral" });
  if (meta?.deterministicReason === "no_evidence") {
    labels.push({ text: "无证据确定性模板", tone: "warning" });
  }
  if (meta?.deterministicReason === "needs_clarification") {
    labels.push({ text: "澄清模板", tone: "warning" });
  }
  if (meta && status === "completed" && !meta.deterministicReason) {
    labels.push({ text: "已完成", tone: "success" });
  }
  return labels;
}
