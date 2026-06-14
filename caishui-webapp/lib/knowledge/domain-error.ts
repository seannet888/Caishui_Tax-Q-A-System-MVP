export type DomainErrorCode =
  | "forbidden_requires_role"
  | "source_document_already_exists"
  | "source_has_historical_citations"
  | "withdrawal_reason_required"
  | "restore_reason_required"
  | "hard_delete_reason_required"
  | "hard_delete_confirmation_required"
  | "file_required"
  | "invalid_request"
  | "unknown_domain_error";

export interface DomainErrorShape {
  code: DomainErrorCode;
  detail?: string;
}

export interface DomainErrorHttp {
  status: number;
  body: {
    error: DomainErrorCode;
    detail?: string;
    documentId?: string;
  };
}

const PREFIXED_CODES: DomainErrorCode[] = [
  "forbidden_requires_role",
  "source_document_already_exists",
];

const EXACT_CODES: DomainErrorCode[] = [
  "source_has_historical_citations",
  "withdrawal_reason_required",
  "restore_reason_required",
  "hard_delete_reason_required",
  "hard_delete_confirmation_required",
  "file_required",
  "invalid_request",
];

export function parseDomainError(error: unknown): DomainErrorShape {
  const message = normalizeErrorMessage(error);

  for (const code of PREFIXED_CODES) {
    if (message === code || message.startsWith(`${code}:`)) {
      const detail = message.slice(code.length + 1) || undefined;
      return { code, detail };
    }
  }

  for (const code of EXACT_CODES) {
    if (message === code) return { code };
  }

  return {
    code: "unknown_domain_error",
    detail: message || undefined,
  };
}

export function domainErrorToHttp(error: DomainErrorShape): DomainErrorHttp {
  const body: DomainErrorHttp["body"] = { error: error.code };
  if (error.detail) body.detail = error.detail;
  if (error.code === "source_document_already_exists" && error.detail) {
    body.documentId = error.detail;
  }

  return {
    status: statusForDomainError(error.code),
    body,
  };
}

export function statusForDomainError(code: DomainErrorCode): number {
  if (code === "forbidden_requires_role") return 403;
  if (
    code === "source_document_already_exists" ||
    code === "source_has_historical_citations"
  ) {
    return 409;
  }
  if (code === "unknown_domain_error") return 400;
  return 400;
}

export function formatDocumentLifecycleErrorCode(
  code: DomainErrorCode | string | undefined,
): string {
  if (!code) return "文档生命周期操作失败。";
  if (code === "source_has_historical_citations") {
    return "该来源已有历史答案引用，不能硬删除；请使用撤出检索。";
  }
  if (code === "forbidden_requires_role") {
    return "当前账号没有执行该操作的权限。";
  }
  if (
    code === "withdrawal_reason_required" ||
    code === "restore_reason_required" ||
    code === "hard_delete_reason_required"
  ) {
    return "请填写操作原因。";
  }
  if (code === "hard_delete_confirmation_required") {
    return "硬删除需要二次确认。";
  }
  return code;
}

function normalizeErrorMessage(error: unknown): string {
  if (typeof error === "string") return stripErrorPrefix(error.trim());
  if (error instanceof Error) return stripErrorPrefix(error.message.trim());
  return stripErrorPrefix(String(error).trim());
}

function stripErrorPrefix(message: string): string {
  return message.replace(/^Error:\s*/u, "");
}
