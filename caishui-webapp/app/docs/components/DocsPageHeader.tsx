import React from "react";
import Link from "next/link";

export function DocsPageHeader() {
  return (
    <header className="rounded-xl border border-[color:var(--cs-border)] bg-[color:var(--cs-surface)] p-6 shadow-[var(--cs-shadow-sm)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[color:var(--cs-primary)]">
            Source documents
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.01em] text-[color:var(--cs-ink)]">
            文档治理
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[color:var(--cs-muted)]">
            查看来源文档的处理状态、检索状态与失败原因。进入详情页可审阅 Chunk，并执行撤出、恢复和核验动作。
          </p>
        </div>
        <Link
          href="/admin/upload"
          className="inline-flex items-center justify-center rounded-lg border border-[color:var(--cs-border)] bg-white px-4 py-2 text-sm font-medium text-[color:var(--cs-primary)] transition hover:border-[color:var(--cs-primary)] focus:outline-none focus:ring-2 focus:ring-[color:var(--cs-primary)]"
        >
          上传来源文档
        </Link>
      </div>
      <div className="mt-5 grid gap-3 text-sm md:grid-cols-3">
        <div className="rounded-lg bg-white p-3 text-[color:var(--cs-muted)]">
          <span className="font-medium text-[color:var(--cs-ink)]">处理状态</span>
          <span className="mt-1 block">解析、清洗与 pipeline 失败可见</span>
        </div>
        <div className="rounded-lg bg-white p-3 text-[color:var(--cs-muted)]">
          <span className="font-medium text-[color:var(--cs-ink)]">检索状态</span>
          <span className="mt-1 block">撤出来源不再参与新回答</span>
        </div>
        <div className="rounded-lg bg-white p-3 text-[color:var(--cs-muted)]">
          <span className="font-medium text-[color:var(--cs-ink)]">审计保留</span>
          <span className="mt-1 block">历史引用快照不随撤出改写</span>
        </div>
      </div>
    </header>
  );
}
