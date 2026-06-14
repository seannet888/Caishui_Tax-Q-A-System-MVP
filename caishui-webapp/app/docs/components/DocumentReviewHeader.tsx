import React from "react";
import type { DocumentReviewModel } from "@/lib/knowledge/document-review-read-model";
import { formatDate } from "@/lib/utils/date";
import { StatusBadge } from "./StatusBadge";
import type { PresentedDocumentLifecycle } from "./document-review-presenter";

export function DocumentReviewHeader({
  document,
  lifecycle,
}: {
  document: DocumentReviewModel["document"];
  lifecycle: PresentedDocumentLifecycle;
}) {
  return (
    <div className="space-y-4">
      <header className="rounded-xl border border-[color:var(--cs-border)] bg-[color:var(--cs-surface)] p-6 shadow-[var(--cs-shadow-sm)]">
        <p className="text-sm font-medium text-[color:var(--cs-primary)]">
          Document review
        </p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-[-0.01em] text-[color:var(--cs-ink)]">
              {document.title}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[color:var(--cs-muted)]">
              <span className="rounded-full border border-[color:var(--cs-border)] bg-white px-3 py-1">
                {document.docNumber ?? "无文号"}
              </span>
              <StatusBadge status={document.processingStatus} />
              <StatusBadge status={document.retrievalStatus} />
            </div>
          </div>
          <div className="rounded-lg bg-white p-3 text-xs leading-5 text-[color:var(--cs-muted)]">
            <div>发布：{formatDate(document.publishDate)}</div>
            <div>生效：{formatDate(document.effectiveDate)}</div>
          </div>
        </div>
      </header>

      {document.processingStatus === "FAILED" && document.errorMessage && (
        <div className="rounded-lg border border-[#f2c3c5] bg-[color:var(--cs-danger-bg)] p-3 text-sm text-[color:var(--cs-danger)]">
          <div className="font-medium">处理失败</div>
          <div className="mt-1 break-words">失败原因：{document.errorMessage}</div>
        </div>
      )}

      <section className={`rounded-xl border p-4 text-sm ${lifecycle.toneClassName}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{lifecycle.title}</span>
          <StatusBadge status={document.retrievalStatus} />
          <span>{lifecycle.summary}</span>
        </div>
        <div className="mt-3 grid gap-2 text-xs md:grid-cols-3">
          {lifecycle.counts.map((count) => (
            <span key={count} className="rounded-lg bg-white/70 px-3 py-2">
              {count}
            </span>
          ))}
        </div>
        <p className="mt-3 text-xs">{lifecycle.actionHint}</p>
      </section>
    </div>
  );
}
