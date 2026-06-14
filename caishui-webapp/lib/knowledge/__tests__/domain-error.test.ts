import { describe, expect, it } from "vitest";
import {
  domainErrorToHttp,
  formatDocumentLifecycleErrorCode,
  parseDomainError,
} from "@/lib/knowledge/domain-error";

describe("Domain Error Module", () => {
  it("normalizes thrown role errors into stable codes and HTTP status", () => {
    const error = parseDomainError(new Error("forbidden_requires_role:admin"));

    expect(error).toEqual({
      code: "forbidden_requires_role",
      detail: "admin",
    });
    expect(domainErrorToHttp(error)).toEqual({
      status: 403,
      body: { error: "forbidden_requires_role", detail: "admin" },
    });
  });

  it("maps duplicate source errors into conflict responses with metadata", () => {
    const error = parseDomainError(
      new Error("source_document_already_exists:doc-123"),
    );

    expect(error).toEqual({
      code: "source_document_already_exists",
      detail: "doc-123",
    });
    expect(domainErrorToHttp(error)).toEqual({
      status: 409,
      body: {
        error: "source_document_already_exists",
        detail: "doc-123",
        documentId: "doc-123",
      },
    });
  });

  it("keeps lifecycle presentation independent from thrown error strings", () => {
    expect(
      formatDocumentLifecycleErrorCode("source_has_historical_citations"),
    ).toBe("该来源已有历史答案引用，不能硬删除；请使用撤出检索。");
    expect(formatDocumentLifecycleErrorCode("forbidden_requires_role")).toBe(
      "当前账号没有执行该操作的权限。",
    );
    expect(formatDocumentLifecycleErrorCode("withdrawal_reason_required")).toBe(
      "请填写操作原因。",
    );
  });
});
