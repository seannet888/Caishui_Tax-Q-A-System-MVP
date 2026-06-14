"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { textareaClassName } from "@/components/ui/FormField";
import { cn } from "@/lib/utils/cn";
import {
  submitDocumentLifecycleAction,
  type DocumentLifecycleAction,
} from "./document-lifecycle-client";

export function DocumentLifecycleActions({
  documentId,
  retrievalStatus,
  canWithdraw,
  canRestore,
}: {
  documentId: string;
  retrievalStatus: string;
  canWithdraw: boolean;
  canRestore: boolean;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [confirmHardDelete, setConfirmHardDelete] = useState(false);
  const [busy, setBusy] = useState<DocumentLifecycleAction | null>(null);
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);

  const trimmedReason = reason.trim();
  const hasReason = trimmedReason.length > 0;
  const isWithdrawn = retrievalStatus === "WITHDRAWN";

  async function submit(action: DocumentLifecycleAction) {
    if (!hasReason) {
      setFeedback({ kind: "error", message: "请填写操作原因。" });
      return;
    }
    if (action === "hardDelete" && !confirmHardDelete) {
      setFeedback({ kind: "error", message: "硬删除需要二次确认。" });
      return;
    }

    setBusy(action);
    setFeedback(null);
    try {
      const result = await submitDocumentLifecycleAction({
        documentId,
        action,
        reason: trimmedReason,
      });
      setFeedback({
        kind: result.ok ? "success" : "error",
        message: result.message,
      });
      if (result.ok) {
        setReason("");
        setConfirmHardDelete(false);
        router.refresh();
      }
    } catch (err) {
      setFeedback({ kind: "error", message: String(err) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-xl border border-[#f0dca8] bg-[color:var(--cs-warning-bg)] p-4 text-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <label className="flex-1">
          <span className="block text-xs font-medium text-[color:var(--cs-warning)]">
            管理原因
          </span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className={cn(textareaClassName, "mt-1 w-full border-[#f0dca8] text-xs")}
            placeholder="填写撤出、恢复或硬删除原因"
          />
        </label>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs text-[color:var(--cs-warning)]">
            <input
              type="checkbox"
              checked={confirmHardDelete}
              onChange={(event) => setConfirmHardDelete(event.target.checked)}
              className="h-4 w-4 rounded border-[#f0dca8] accent-[color:var(--cs-danger)]"
            />
            确认执行受限硬删除
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="warning"
              size="sm"
              disabled={busy !== null || !hasReason || !canWithdraw}
              onClick={() => submit("withdraw")}
            >
              {busy === "withdraw" ? "撤出中..." : isWithdrawn ? "已撤出" : "撤出检索"}
            </Button>
            {canRestore && (
              <Button
                type="button"
                variant="success"
                size="sm"
                disabled={busy !== null || !hasReason}
                onClick={() => submit("restore")}
              >
                {busy === "restore" ? "恢复中..." : "恢复检索"}
              </Button>
            )}
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={busy !== null || !hasReason || !confirmHardDelete}
              onClick={() => submit("hardDelete")}
            >
              {busy === "hardDelete" ? "删除中..." : "硬删除"}
            </Button>
          </div>
        </div>
      </div>

      {feedback && (
        <p
          className={
            feedback.kind === "success"
              ? "mt-2 text-xs font-medium text-[#1f8a5b]"
              : "mt-2 text-xs font-medium text-[color:var(--cs-danger)]"
          }
        >
          {feedback.message}
        </p>
      )}
    </section>
  );
}
