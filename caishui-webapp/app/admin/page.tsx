import React from "react";
import Link from "next/link";

const cards = [
  {
    href: "/admin/upload",
    title: "上传文档",
    description: "上传 PDF / MD / Excel / CSV，先预览分块，再触发清洗入库。",
    meta: "Source intake",
  },
  {
    href: "/docs",
    title: "文档治理",
    description: "查看处理状态、检索状态、Chunk 分布，并执行撤出、恢复与核验动作。",
    meta: "Lifecycle",
  },
];

export default function AdminPage() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header className="rounded-xl border border-[color:var(--cs-border)] bg-[color:var(--cs-surface)] p-6 shadow-[var(--cs-shadow-sm)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[color:var(--cs-primary)]">
              Administration
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.01em] text-[color:var(--cs-ink)]">
              后台管理
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[color:var(--cs-muted)]">
              治理工作台用于管理来源文档、清洗任务与审计动作。默认通过撤出/恢复保留历史轨迹，硬删除仅用于受限场景。
            </p>
          </div>
          <span className="rounded-full bg-[#e7f4fb] px-3 py-1 text-xs font-medium text-[color:var(--cs-primary-dark)]">
            治理工作台
          </span>
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-2">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group rounded-xl border border-[color:var(--cs-border)] bg-white p-5 shadow-[var(--cs-shadow-sm)] transition hover:border-[color:var(--cs-primary)] hover:bg-[#fbfdff] focus:outline-none focus:ring-2 focus:ring-[color:var(--cs-primary)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-[color:var(--cs-primary)]">
                  {card.meta}
                </p>
                <div className="mt-2 text-base font-semibold text-[color:var(--cs-ink)]">
                  {card.title}
                </div>
              </div>
              <span className="rounded-full bg-[#eef7fc] px-2.5 py-1 text-xs text-[color:var(--cs-primary-dark)] transition group-hover:bg-[#dff1fa]">
                进入
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-[color:var(--cs-muted)]">
              {card.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
