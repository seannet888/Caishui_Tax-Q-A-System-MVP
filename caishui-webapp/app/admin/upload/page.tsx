import React from "react";
import { UploadForm } from "../components/UploadForm";

export default function UploadPage() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header className="rounded-xl border border-[color:var(--cs-border)] bg-[color:var(--cs-surface)] p-6 shadow-[var(--cs-shadow-sm)]">
        <p className="text-sm font-medium text-[color:var(--cs-primary)]">
          Source intake
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-[-0.01em] text-[color:var(--cs-ink)]">
              上传来源文档
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[color:var(--cs-muted)]">
              先预览，再清洗入库。只有通过 Seed 或 Human 核验的 Chunk 才会进入生产检索。
            </p>
          </div>
          <span className="rounded-full bg-[#e7f4fb] px-3 py-1 text-xs font-medium text-[color:var(--cs-primary-dark)]">
            先预览，再清洗入库
          </span>
        </div>
      </header>
      <UploadForm />
    </div>
  );
}
