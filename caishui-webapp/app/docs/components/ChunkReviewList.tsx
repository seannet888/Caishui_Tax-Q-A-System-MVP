import React from "react";
import type {
  ChunkPagination,
  ChunkReviewItem,
} from "@/lib/knowledge/document-review-read-model";
import { formatDate } from "@/lib/utils/date";
import { ChunkEmbeddingRetryAction } from "./ChunkEmbeddingRetryAction";
import { ChunkReviewActions } from "./ChunkReviewActions";
import { presentChunkReadiness } from "./document-review-presenter";
import { StatusBadge } from "./StatusBadge";

export function ChunkReviewList({
  chunks,
  pagination,
}: {
  chunks: ChunkReviewItem[];
  pagination: ChunkPagination;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-col justify-between gap-2 md:flex-row md:items-center">
        <div>
          <h2 className="text-base font-semibold text-[color:var(--cs-ink)]">
            Chunk 审阅
          </h2>
          <p className="mt-1 text-sm text-[color:var(--cs-muted)]">
            核验状态、向量化状态与检索状态共同决定 chunk 是否可用于新回答。
          </p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs text-[color:var(--cs-muted)]">
          第 {pagination.chunkPage} / {pagination.chunkPageCount} 页，共{" "}
          {pagination.chunkTotal} 个
        </span>
      </div>

      <ul className="space-y-3 text-xs">
        {chunks.map((chunk) => {
          const readiness = presentChunkReadiness(chunk);
          return (
            <li
              key={chunk.id}
              className="rounded-xl border border-[color:var(--cs-border)] bg-white p-4 shadow-[var(--cs-shadow-sm)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 text-[color:var(--cs-muted)]">
                  <span className="rounded-full bg-[#eef7fc] px-2.5 py-1 font-medium text-[color:var(--cs-primary-dark)]">
                    Chunk {chunk.index}
                  </span>
                  <span>{chunk.type}</span>
                  {chunk.articleNumber && <span>{chunk.articleNumber}</span>}
                </div>
                <span className={`rounded-full border px-2.5 py-1 ${readiness.toneClassName}`}>
                  {readiness.label}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <StatusBadge status={chunk.embeddingStatus} />
                <StatusBadge status={chunk.verificationStatus} />
                <StatusBadge status={chunk.retrievalStatus} />
                <span className="rounded bg-[#f7fbfe] px-2 py-0.5 text-[color:var(--cs-muted)]">
                  生效：{formatDate(chunk.effectiveDate)}
                </span>
                <span className="rounded bg-[#f7fbfe] px-2 py-0.5 text-[color:var(--cs-muted)]">
                  失效：{formatDate(chunk.expireDate)}
                </span>
              </div>

              <p className="mt-3 line-clamp-4 whitespace-pre-wrap leading-5 text-[color:var(--cs-ink)]">
                {chunk.content}
              </p>

              {readiness.message && (
                <div className={`mt-3 rounded-lg border px-3 py-2 ${readiness.toneClassName}`}>
                  {readiness.message}
                </div>
              )}

              <div className="mt-3 grid gap-1 text-[color:var(--cs-muted)] md:grid-cols-2">
                <span>hash: {chunk.contentHash.slice(0, 12)}</span>
                <span>核验方式：{chunk.verificationMethod ?? "未核验"}</span>
                {chunk.verifiedBy && <span>核验人：{chunk.verifiedBy}</span>}
                {chunk.verifiedAt && <span>核验时间：{formatDate(chunk.verifiedAt)}</span>}
                {chunk.verificationNotes && (
                  <span className="md:col-span-2">
                    备注：{chunk.verificationNotes}
                  </span>
                )}
              </div>

              {chunk.canReview && <ChunkReviewActions chunkId={chunk.id} />}
              {chunk.canRetryEmbedding && (
                <ChunkEmbeddingRetryAction chunkId={chunk.id} />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
