"use client";

import React from "react";
import type { ChunkOutput } from "@/types/pipeline";

// 清洗结果预览：调用 data-pipeline /preview（不入库）后展示。
export function ChunkPreview({ chunks }: { chunks: ChunkOutput[] }) {
  if (chunks.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-[color:var(--cs-border)] bg-[#f7fbfe] p-4 text-sm text-[color:var(--cs-muted)]">
        暂无预览。
      </p>
    );
  }
  return (
    <ul className="space-y-3 text-xs">
      {chunks.map((c) => (
        <li
          key={c.chunk_id}
          className="rounded-lg border border-[color:var(--cs-divider)] bg-[#f7fbfe] p-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white px-2.5 py-1 font-medium text-[color:var(--cs-primary-dark)]">
              Chunk {c.chunk_index}
            </span>
            <span className="rounded-full bg-white px-2.5 py-1 text-[color:var(--cs-muted)]">
              {c.chunk_type}
            </span>
          </div>
          <div className="mt-3 grid gap-1 text-[color:var(--cs-muted)]">
            <span>文号：{c.metadata.doc_number ?? "无文号"}</span>
            <span>来源：{c.metadata.source_channel ?? "未知"}</span>
            <span>管辖地：{c.metadata.jurisdiction ?? "未知"}</span>
            <span>生效：{c.metadata.effective_date ?? "未知"}</span>
          </div>
          <p className="mt-2 line-clamp-4 whitespace-pre-wrap leading-5 text-[color:var(--cs-ink)]">
            {c.content}
          </p>
        </li>
      ))}
    </ul>
  );
}
