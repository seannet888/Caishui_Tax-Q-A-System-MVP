// app/docs/[docId]/page.tsx — 文档详情（查看 chunk 分布）。
import { notFound } from "next/navigation";
import { loadDocumentReview } from "@/lib/knowledge/document-review-read-model";
import { ChunkReviewList } from "../components/ChunkReviewList";
import { DocumentReviewHeader } from "../components/DocumentReviewHeader";
import { DocumentLifecycleActions } from "../components/DocumentLifecycleActions";
import { presentDocumentLifecycle } from "../components/document-review-presenter";

export const dynamic = "force-dynamic";

export default async function DocDetailPage({
  params,
  searchParams,
}: {
  params: { docId: string };
  searchParams?: { chunkPage?: string; chunkPageSize?: string };
}) {
  const chunkPage = readPositiveInt(searchParams?.chunkPage, 1);
  const chunkPageSize = readPositiveInt(searchParams?.chunkPageSize, 50);
  const review = await loadDocumentReview(params.docId, {
    chunkPage,
    chunkPageSize,
  });
  if (!review) notFound();
  const { document: doc, chunks, pagination } = review;
  const lifecycle = presentDocumentLifecycle(doc.lifecycle);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <DocumentReviewHeader document={doc} lifecycle={lifecycle} />

      <DocumentLifecycleActions
        documentId={doc.id}
        retrievalStatus={doc.retrievalStatus}
        canWithdraw={doc.lifecycle.canWithdraw}
        canRestore={doc.lifecycle.canRestore}
      />

      <ChunkReviewList chunks={chunks} pagination={pagination} />
    </div>
  );
}

function readPositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.floor(parsed));
}
