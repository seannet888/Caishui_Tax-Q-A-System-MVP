// lib/knowledge/citation-presentation.ts
// 将不可变 Citation Snapshot 与追加式 Annotation 合成为前端展示模型。

import type { CitationSnapshot } from "@/types/knowledge";

export type CitationAnnotationInput = {
  annotation_type: string;
  message: string;
  resolved_at?: string | Date | null;
};

export type PresentedCitationStatus =
  | "active"
  | "withdrawn"
  | "content_error";

export type PresentedCitationSeverity = "normal" | "warning" | "danger";

export interface CitationPresentationInput {
  id: string;
  snapshot: CitationSnapshot;
  annotations?: CitationAnnotationInput[];
}

export interface PresentedCitation {
  id: string;
  chunkId: string;
  docNumber?: string;
  title: string;
  sourceDocumentName: string;
  sourceLocation?: { page?: number; section?: string };
  answeredAt: string;
  evidenceExcerpt: string;
  isTruncated: boolean;
  includesTable: boolean;
  tableTruncated: boolean;
  snapshotContentHash: string;
  status: PresentedCitationStatus;
  severity: PresentedCitationSeverity;
  badges: string[];
  warnings: string[];
}

export function presentCitation(
  input: CitationPresentationInput,
): PresentedCitation {
  const activeAnnotations = (input.annotations ?? []).filter(
    (annotation) => !annotation.resolved_at,
  );
  const hasContentError = activeAnnotations.some(
    (annotation) => annotation.annotation_type === "content_error",
  );
  const hasSourceWithdrawn = activeAnnotations.some(
    (annotation) => annotation.annotation_type === "source_withdrawn",
  );

  const status: PresentedCitationStatus = hasContentError
    ? "content_error"
    : hasSourceWithdrawn
      ? "withdrawn"
      : "active";
  const severity: PresentedCitationSeverity =
    status === "content_error"
      ? "danger"
      : status === "withdrawn"
        ? "warning"
        : "normal";

  return {
    id: input.id,
    chunkId: input.snapshot.chunkId,
    docNumber: input.snapshot.docNumber,
    title: input.snapshot.title,
    sourceDocumentName: input.snapshot.sourceDocumentName,
    sourceLocation: input.snapshot.sourceLocation,
    answeredAt: input.snapshot.answeredAt,
    evidenceExcerpt: input.snapshot.evidenceExcerpt,
    isTruncated: input.snapshot.isTruncated,
    includesTable: input.snapshot.includesTable,
    tableTruncated: input.snapshot.tableTruncated,
    snapshotContentHash: input.snapshot.chunkContentHash,
    status,
    severity,
    badges: buildBadges(status),
    warnings: activeAnnotations.map((annotation) => annotation.message),
  };
}

export function presentCitations(
  inputs: CitationPresentationInput[],
): PresentedCitation[] {
  return inputs.map((input) => presentCitation(input));
}

function buildBadges(status: PresentedCitationStatus): string[] {
  if (status === "content_error") return ["内容可能错误"];
  if (status === "withdrawn") return ["来源已撤出"];
  return [];
}
