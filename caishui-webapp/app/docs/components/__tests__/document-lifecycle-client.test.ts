import { describe, expect, it, vi } from "vitest";
import { submitDocumentLifecycleAction } from "../document-lifecycle-client";

describe("submitDocumentLifecycleAction", () => {
  it("撤出检索时调用 documents POST API 并返回成功消息", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({ ok: true }, { status: 200 }),
    );

    await expect(
      submitDocumentLifecycleAction({
        documentId: "doc-1",
        action: "withdraw",
        reason: "来源文件已过期",
        fetcher,
      }),
    ).resolves.toEqual({
      ok: true,
      message: "已撤出当前检索。",
    });

    expect(fetcher).toHaveBeenCalledWith("/api/documents/doc-1", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "withdraw",
        reason: "来源文件已过期",
      }),
    });
  });

  it("硬删除遇到历史引用冲突时返回管理端可理解的提示", async () => {
    const fetcher = vi.fn(async () =>
      Response.json(
        { error: "source_has_historical_citations" },
        { status: 409 },
      ),
    );

    await expect(
      submitDocumentLifecycleAction({
        documentId: "doc-1",
        action: "hardDelete",
        reason: "误上传测试文件",
        fetcher,
      }),
    ).resolves.toEqual({
      ok: false,
      message: "该来源已有历史答案引用，不能硬删除；请使用撤出检索。",
    });

    expect(fetcher).toHaveBeenCalledWith("/api/documents/doc-1", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        confirm: true,
        reason: "误上传测试文件",
      }),
    });
  });

  it("恢复检索时调用 documents POST API 并返回成功消息", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({ ok: true }, { status: 200 }),
    );

    await expect(
      submitDocumentLifecycleAction({
        documentId: "doc-1",
        action: "restore",
        reason: "已重新核对来源",
        fetcher,
      }),
    ).resolves.toEqual({
      ok: true,
      message: "已恢复当前检索。",
    });

    expect(fetcher).toHaveBeenCalledWith("/api/documents/doc-1", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "restore",
        reason: "已重新核对来源",
      }),
    });
  });
});
