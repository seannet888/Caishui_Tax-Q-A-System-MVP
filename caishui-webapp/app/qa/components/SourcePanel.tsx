import React from "react";
import type { CitationSnapshot } from "@/types/knowledge";
import { formatDate } from "@/lib/utils/date";
import type { PresentedCitation } from "@/lib/knowledge/citation-presentation";
import { presentCitations } from "@/lib/knowledge/citation-presentation";
import { StatusPill, type StatusTone } from "@/components/ui/StatusPill";
import { cn } from "@/lib/utils/cn";

// 检索来源展示面板：基于 Citation Snapshot 渲染，不依赖实时 chunk 内容。
export function SourcePanel({
  citations,
  presentedCitations,
}: {
  citations?: CitationSnapshot[];
  presentedCitations?: PresentedCitation[];
}) {
  const items =
    presentedCitations ??
    presentCitations(
      (citations ?? []).map((snapshot, index) => ({
        id: `${snapshot.chunkId}-${index}`,
        snapshot,
      })),
    );
  if (items.length === 0) return null;
  return (
    <aside className="space-y-3 rounded-xl border border-[color:var(--cs-border)] bg-white/[0.86] p-3 text-xs text-[color:var(--cs-muted)] shadow-[var(--cs-shadow-sm)]">
      <div className="flex items-center justify-between gap-3 border-b border-[color:var(--cs-divider)] pb-2">
        <div className="flex items-center gap-2 font-semibold text-[color:var(--cs-ink)]">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#e4f3fb] text-[color:var(--cs-primary)]">
            引
          </span>
          引用来源
        </div>
        <span className="text-[11px] font-medium text-[color:var(--cs-muted)]">
          {items.length} 条
        </span>
      </div>
      {items.map((c, i) => (
        <article key={c.id} className={sourceItemClass(c.severity)}>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 flex h-6 min-w-6 items-center justify-center rounded-md bg-[color:var(--cs-primary)] px-1 text-xs font-bold text-white">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold leading-5 text-[color:var(--cs-ink)]">
                {c.title}
              </div>
              <div className="mt-1 space-y-0.5 leading-5">
                <MetaLine label="文号" value={c.docNumber ?? "未知文号"} />
                <MetaLine label="来源" value={c.sourceDocumentName} />
                <MetaLine label="回答" value={formatDate(c.answeredAt)} />
                {c.sourceLocation && (
                  <MetaLine label="位置" value={formatLocation(c.sourceLocation)} />
                )}
              </div>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5 pl-8">
            <StatusPill tone={toneForSeverity(c.severity)} className="font-medium">
              {statusLabel(c.status)}
            </StatusPill>
            {c.includesTable && (
              <StatusPill tone={c.tableTruncated ? "warning" : "info"}>
                {c.tableTruncated ? "表格快照已截断" : "含表格快照"}
              </StatusPill>
            )}
            {c.badges.map((badge) => (
              <StatusPill key={badge} tone={toneForSeverity(c.severity)}>
                {badge}
              </StatusPill>
            ))}
          </div>
          {c.warnings.map((warning) => (
            <div key={warning} className={warningClass(c.severity)}>
              {warning}
            </div>
          ))}
          <p className="mt-2 line-clamp-5 whitespace-pre-wrap rounded-lg bg-white px-3 py-2 leading-5 text-[color:var(--cs-ink)]">
            {c.evidenceExcerpt}
            {c.isTruncated && (
              <span className="text-[color:var(--cs-warning)]"> [截断]</span>
            )}
          </p>
          <div className="mt-2 break-all pl-1 text-[11px] leading-5 text-[color:var(--cs-muted)]">
            hash: {c.snapshotContentHash}
          </div>
        </article>
      ))}
    </aside>
  );
}

function sourceItemClass(severity: PresentedCitation["severity"]): string {
  return cn(
    "rounded-xl border p-3 transition",
    severity === "danger" &&
      "border-[#f2c3c5] bg-[color:var(--cs-danger-bg)]",
    severity === "warning" &&
      "border-[#f0dca8] bg-[color:var(--cs-warning-bg)]",
    severity === "normal" && "border-[color:var(--cs-divider)] bg-white",
  );
}

function warningClass(severity: PresentedCitation["severity"]): string {
  return severity === "danger"
    ? "mt-2 pl-8 font-medium text-[color:var(--cs-danger)]"
    : "mt-2 pl-8 font-medium text-[color:var(--cs-warning)]";
}

function toneForSeverity(severity: PresentedCitation["severity"]): StatusTone {
  if (severity === "danger") return "danger";
  if (severity === "warning") return "warning";
  return "success";
}

function statusLabel(status: PresentedCitation["status"]): string {
  if (status === "content_error") return "内容风险";
  if (status === "withdrawn") return "已撤出";
  return "快照有效";
}

function formatLocation(location: { page?: number; section?: string }): string {
  const parts = [];
  if (typeof location.page === "number") parts.push(`第 ${location.page} 页`);
  if (location.section) parts.push(location.section);
  return parts.join(" · ") || "未标注";
}

function MetaLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[2.5rem_1fr] gap-2">
      <span className="text-[color:var(--cs-muted)]">{label}</span>
      <span className="min-w-0 break-words text-[color:var(--cs-muted)]">
        {value}
      </span>
    </div>
  );
}
