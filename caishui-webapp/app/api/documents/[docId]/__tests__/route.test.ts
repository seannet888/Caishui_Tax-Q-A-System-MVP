import { beforeEach, describe, expect, it, vi } from "vitest";

const { hardDeleteSourceWithAudit } = vi.hoisted(() => ({
  hardDeleteSourceWithAudit: vi.fn(async () => undefined),
}));
const { restoreSourceWithAudit, withdrawSourceWithAudit } = vi.hoisted(() => ({
  restoreSourceWithAudit: vi.fn(async () => undefined),
  withdrawSourceWithAudit: vi.fn(async () => undefined),
}));
const { getDocument } = vi.hoisted(() => ({
  getDocument: vi.fn(),
}));

vi.mock("@/lib/knowledge/source-hard-delete", () => ({
  hardDeleteSourceWithAudit,
}));

vi.mock("@/lib/db/queries/documents", () => ({
  getDocument,
}));

vi.mock("@/lib/knowledge/source-withdrawal", () => ({
  restoreSourceWithAudit,
  withdrawSourceWithAudit,
}));

import { DELETE, GET, POST } from "@/app/api/documents/[docId]/route";

describe("GET /api/documents/[docId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes chunk pagination options to the document query", async () => {
    getDocument.mockResolvedValueOnce({
      id: "doc-1",
      chunks: [],
      _count: { chunks: 125 },
    });

    const response = await GET(
      new Request("http://localhost/api/documents/doc-1?chunkPage=3&chunkPageSize=25") as never,
      { params: { docId: "doc-1" } },
    );

    expect(response.status).toBe(200);
    expect(getDocument).toHaveBeenCalledWith("doc-1", {
      skip: 50,
      take: 25,
    });
  });
});

describe("DELETE /api/documents/[docId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MVP_ACTOR_ID = "admin-1";
    process.env.MVP_ACTOR_ROLES = "admin";
    process.env.TRUST_PROXY_AUTH = "false";
  });

  it("执行受限硬删除并返回 ok", async () => {
    const response = await DELETE(
      new Request("http://localhost/api/documents/doc-1", {
        method: "DELETE",
        body: JSON.stringify({
          confirm: true,
          reason: "误上传测试文件",
        }),
      }) as never,
      { params: { docId: "doc-1" } },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(hardDeleteSourceWithAudit).toHaveBeenCalledWith(
      "doc-1",
      { id: "admin-1", roles: ["admin"] },
      { confirm: true, reason: "误上传测试文件" },
    );
  });

  it("存在历史引用时返回 409", async () => {
    hardDeleteSourceWithAudit.mockRejectedValueOnce(
      new Error("source_has_historical_citations"),
    );

    const response = await DELETE(
      new Request("http://localhost/api/documents/doc-1", {
        method: "DELETE",
        body: JSON.stringify({
          confirm: true,
          reason: "误上传测试文件",
        }),
      }) as never,
      { params: { docId: "doc-1" } },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "source_has_historical_citations",
    });
  });
});

describe("POST /api/documents/[docId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MVP_ACTOR_ID = "admin-1";
    process.env.MVP_ACTOR_ROLES = "admin";
    process.env.TRUST_PROXY_AUTH = "false";
  });

  it("action=restore 时恢复来源检索资格", async () => {
    const response = await POST(
      new Request("http://localhost/api/documents/doc-1", {
        method: "POST",
        body: JSON.stringify({
          action: "restore",
          reason: "已重新核对来源",
        }),
      }) as never,
      { params: { docId: "doc-1" } },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(restoreSourceWithAudit).toHaveBeenCalledWith(
      "doc-1",
      { id: "admin-1", roles: ["admin"] },
      "已重新核对来源",
    );
    expect(withdrawSourceWithAudit).not.toHaveBeenCalled();
  });
});
