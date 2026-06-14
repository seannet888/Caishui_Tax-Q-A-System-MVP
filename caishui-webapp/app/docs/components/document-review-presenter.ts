import type {
  ChunkReviewItem,
  DocumentLifecycleSummary,
} from "@/lib/knowledge/document-review-read-model";

export interface PresentedDocumentLifecycle {
  title: string;
  toneClassName: string;
  summary: string;
  actionHint: string;
  counts: string[];
}

export interface PresentedChunkReadiness {
  label: string;
  message: string | null;
  toneClassName: string;
}

export function presentDocumentLifecycle(
  lifecycle: DocumentLifecycleSummary,
): PresentedDocumentLifecycle {
  return {
    title: documentLifecycleTitle(lifecycle.retrievalState),
    toneClassName: documentLifecycleTone(lifecycle.retrievalState),
    summary: lifecycle.summary,
    actionHint: documentLifecycleActionHint(lifecycle),
    counts: [
      `已就绪：${lifecycle.readyChunkCount}`,
      `未就绪：${lifecycle.blockedChunkCount}`,
      `待核验：${lifecycle.unverifiedChunkCount}`,
    ],
  };
}

export function presentChunkReadiness(
  chunk: Pick<ChunkReviewItem, "retrievalReadiness" | "readinessMessage">,
): PresentedChunkReadiness {
  if (chunk.retrievalReadiness === "ready") {
    return {
      label: "可检索",
      message: null,
      toneClassName: "border-[#cfe8de] bg-[color:var(--cs-success-bg)] text-[#1f8a5b]",
    };
  }
  if (chunk.retrievalReadiness === "not_verified") {
    return {
      label: "待核验",
      message: chunk.readinessMessage,
      toneClassName: "border-[color:var(--cs-border)] bg-[#f8fbfd] text-[color:var(--cs-muted)]",
    };
  }
  return {
    label: "检索阻塞",
    message: chunk.readinessMessage,
    toneClassName: "border-[#f0dca8] bg-[color:var(--cs-warning-bg)] text-[color:var(--cs-warning)]",
  };
}

function documentLifecycleTitle(
  state: DocumentLifecycleSummary["retrievalState"],
): string {
  if (state === "retrievable") return "检索状态正常";
  if (state === "withdrawn") return "已撤出检索";
  if (state === "failed") return "处理失败";
  return "尚未检索就绪";
}

function documentLifecycleTone(
  state: DocumentLifecycleSummary["retrievalState"],
): string {
  if (state === "retrievable") {
    return "border-[#cfe8de] bg-[color:var(--cs-success-bg)] text-[#1f8a5b]";
  }
  if (state === "withdrawn") {
    return "border-[#f0dca8] bg-[color:var(--cs-warning-bg)] text-[color:var(--cs-warning)]";
  }
  if (state === "failed") {
    return "border-[#f2c3c5] bg-[color:var(--cs-danger-bg)] text-[color:var(--cs-danger)]";
  }
  return "border-[color:var(--cs-border)] bg-[#f8fbfd] text-[color:var(--cs-ink)]";
}

function documentLifecycleActionHint(lifecycle: DocumentLifecycleSummary): string {
  if (lifecycle.canRestore) {
    return "新回答不会引用该来源；如确认可重新使用，可填写原因后恢复检索。";
  }
  if (lifecycle.retrievalState === "retrievable") {
    return "新回答可以引用已就绪 chunk；未就绪 chunk 仍需核验或完成向量化。";
  }
  if (lifecycle.retrievalState === "failed") {
    return "请先处理上传或清洗失败原因；失败来源不会产生可检索证据。";
  }
  return "请先完成 chunk 核验和向量化；未就绪来源不会被默认检索稳定召回。";
}
