"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { presentChunkReviewResponse } from "./chunk-review-response-presenter";

export function ChunkEmbeddingRetryAction({ chunkId }: { chunkId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function retryEmbedding() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/chunks/${chunkId}/embed`, {
        method: "POST",
      });
      const view = presentChunkReviewResponse(await res.json());
      if (!res.ok || !view.ok) throw new Error(view.message ?? "embed_failed");
      setMessage(view.message ?? "已重新提交向量化任务");
      router.refresh();
    } catch (err) {
      setMessage(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={busy}
        onClick={retryEmbedding}
        className="border-[#f0dca8] bg-[color:var(--cs-warning-bg)] text-[color:var(--cs-warning)] hover:border-[color:var(--cs-warning)]"
      >
        {busy ? "提交中..." : "重新触发向量化"}
      </Button>
      {message && (
        <p className="mt-1 text-xs text-[color:var(--cs-warning)]">{message}</p>
      )}
    </div>
  );
}
