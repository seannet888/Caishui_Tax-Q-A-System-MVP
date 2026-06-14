import React from "react";
import Link from "next/link";
import type { SourceDocument } from "@prisma/client";
import { StatusBadge } from "./StatusBadge";
import { formatDate } from "@/lib/utils/date";

export function DocTable({ documents }: { documents: SourceDocument[] }) {
  if (documents.length === 0) {
    return (
      <div className="rounded-xl border border-[color:var(--cs-border)] bg-[color:var(--cs-surface)] p-6 shadow-[var(--cs-shadow-sm)]">
        <div className="max-w-2xl">
          <h2 className="text-base font-semibold text-[color:var(--cs-ink)]">
            暂无来源文档
          </h2>
          <p className="mt-2 text-sm leading-6 text-[color:var(--cs-muted)]">
            上传官方来源文件后，这里会显示处理状态、检索状态和失败原因。建议先预览分块，再清洗入库。
          </p>
          <div className="mt-4">
            <Link
              href="/admin/upload"
              className="inline-flex items-center justify-center rounded-lg bg-[color:var(--cs-primary-dark)] px-4 py-2 text-sm font-medium text-white shadow-[0_4px_12px_rgba(0,107,166,0.18)] transition hover:bg-[color:var(--cs-primary-hover)] focus:outline-none focus:ring-2 focus:ring-[color:var(--cs-primary)] focus:ring-offset-2"
            >
              上传来源文档
            </Link>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-[color:var(--cs-border)] bg-white shadow-[var(--cs-shadow-sm)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-[color:var(--cs-divider)] bg-[#f8fbfd] text-left text-xs font-medium text-[color:var(--cs-muted)]">
            <tr>
              <th className="px-4 py-3">标题</th>
              <th className="px-4 py-3">文号</th>
              <th className="px-4 py-3">处理状态</th>
              <th className="px-4 py-3">检索状态</th>
              <th className="px-4 py-3">发布日期</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((d) => (
              <tr
                key={d.id}
                className={[
                  "border-b border-[color:var(--cs-divider)] transition last:border-0 hover:bg-[#f8fbfd]",
                  d.retrieval_status === "WITHDRAWN" ? "bg-[#f8fbfd]" : "",
                ].join(" ")}
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/docs/${d.id}`}
                    className="font-medium text-[color:var(--cs-primary)] hover:underline"
                  >
                    {d.title}
                  </Link>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[color:var(--cs-muted)]">
                    <span>来源：{d.source_channel ?? "未知"}</span>
                    <span>管辖地：{d.jurisdiction ?? "未知"}</span>
                  </div>
                  {d.processing_status === "FAILED" && d.error_message && (
                    <div className="mt-1 max-w-xl break-words text-xs text-[color:var(--cs-danger)]">
                      失败原因：{d.error_message}
                    </div>
                  )}
                  {d.retrieval_status === "WITHDRAWN" && (
                    <div className="mt-1 text-xs text-[color:var(--cs-warning)]">
                      已撤出当前检索，历史引用快照仍保留用于审计。
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-[color:var(--cs-muted)]">
                  {d.doc_number ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={d.processing_status} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={d.retrieval_status} />
                </td>
                <td className="px-4 py-3 text-[color:var(--cs-muted)]">
                  {formatDate(d.publish_date)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
