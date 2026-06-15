import { formatDocumentLifecycleErrorCode } from "@/lib/knowledge/domain-error";

export type DocumentLifecycleAction = "withdraw" | "restore" | "hardDelete";

export interface DocumentLifecycleResult {
  ok: boolean;
  message: string;
  nextNavigation?: { kind: "redirect"; href: string };
}

export async function submitDocumentLifecycleAction({
  documentId,
  action,
  reason,
  fetcher = fetch,
}: {
  documentId: string;
  action: DocumentLifecycleAction;
  reason: string;
  fetcher?: typeof fetch;
}): Promise<DocumentLifecycleResult> {
  const response = await fetcher(`/api/documents/${documentId}`, {
    method: action === "hardDelete" ? "DELETE" : "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(requestBody(action, reason)),
  });

  if (!response.ok) {
    const data = (await response.json()) as {
      error?: string;
      detail?: string;
    };
    return {
      ok: false,
      message: formatDocumentLifecycleError(data.error),
    };
  }

  return {
    ok: true,
    message: successMessage(action),
    ...(action === "hardDelete"
      ? { nextNavigation: { kind: "redirect" as const, href: "/docs" } }
      : {}),
  };
}

function successMessage(action: DocumentLifecycleAction): string {
  if (action === "withdraw") return "已撤出当前检索。";
  if (action === "restore") return "已恢复当前检索。";
  return "已硬删除来源。";
}

function requestBody(action: DocumentLifecycleAction, reason: string) {
  if (action === "hardDelete") {
    return {
      confirm: true,
      reason,
    };
  }
  return {
    action,
    reason,
  };
}

function formatDocumentLifecycleError(error: string | undefined): string {
  if (!error) return "文档生命周期操作失败。";
  const direct = formatDocumentLifecycleErrorCode(error);
  if (direct !== error) return direct;

  // Backward compatibility for pre-structured route responses.
  const legacyCode = error.replace(/^Error:\s*/u, "").split(":")[0];
  const legacy = formatDocumentLifecycleErrorCode(legacyCode);
  if (legacy !== legacyCode) return legacy;
  return error;
}
