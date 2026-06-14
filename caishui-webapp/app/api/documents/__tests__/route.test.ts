import { describe, expect, it, vi } from "vitest";

const { listDocuments } = vi.hoisted(() => ({
  listDocuments: vi.fn(async () => ({ items: [], total: 0 })),
}));

vi.mock("@/lib/db/queries/documents", () => ({
  listDocuments,
}));

import { GET } from "@/app/api/documents/route";

describe("GET /api/documents", () => {
  it("normalizes invalid pagination query params to safe defaults", async () => {
    const response = await GET(
      new Request("http://localhost/api/documents?page=abc&pageSize=abc") as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });
    expect(listDocuments).toHaveBeenCalledWith({ skip: 0, take: 20 });
  });

  it("clamps pageSize to the maximum supported page size", async () => {
    const response = await GET(
      new Request("http://localhost/api/documents?page=2&pageSize=999") as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      items: [],
      total: 0,
      page: 2,
      pageSize: 100,
    });
    expect(listDocuments).toHaveBeenCalledWith({ skip: 100, take: 100 });
  });
});
