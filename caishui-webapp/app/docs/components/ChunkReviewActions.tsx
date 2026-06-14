"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { textareaClassName } from "@/components/ui/FormField";
import { cn } from "@/lib/utils/cn";
import { presentChunkReviewResponse } from "./chunk-review-response-presenter";

export function ChunkReviewActions({ chunkId }: { chunkId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"verify" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(action: "verify" | "reject") {
    const trimmed = note.trim();
    if (!trimmed) {
      setError(action === "verify" ? "请填写核验依据" : "请填写拒绝原因");
      return;
    }
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/chunks/${chunkId}/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          action === "verify" ? { notes: trimmed } : { reason: trimmed },
        ),
      });
      const view = presentChunkReviewResponse(await res.json());
      if (!res.ok || !view.ok) throw new Error(view.message ?? `${action}_failed`);
      setNote("");
      if (view.message) setError(view.message);
      router.refresh();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="核验依据或拒绝原因"
        className={cn(textareaClassName, "w-full text-xs")}
      />
      <div className="flex gap-2">
        <Button
          type="button"
          variant="success"
          size="sm"
          disabled={busy !== null}
          onClick={() => submit("verify")}
        >
          {busy === "verify" ? "核验中..." : "核验通过"}
        </Button>
        <Button
          type="button"
          variant="danger"
          size="sm"
          disabled={busy !== null}
          onClick={() => submit("reject")}
        >
          {busy === "reject" ? "拒绝中..." : "拒绝"}
        </Button>
      </div>
      {error && <p className="text-xs font-medium text-[color:var(--cs-danger)]">{error}</p>}
    </div>
  );
}
