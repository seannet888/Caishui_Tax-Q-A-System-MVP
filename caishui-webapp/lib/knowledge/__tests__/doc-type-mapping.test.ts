import { describe, expect, it } from "vitest";
import {
  normalizeDocType,
  toPipelineDocType,
  toPrismaDocType,
} from "@/lib/knowledge/doc-type-mapping";

describe("DocType mapping", () => {
  it("把表单输入同时归一化为 Prisma enum 和 pipeline wire value", () => {
    const normalized = normalizeDocType("ANNOUNCEMENT");

    expect(normalized).toEqual({
      prisma: "ANNOUNCEMENT",
      pipeline: "announcement",
    });
    expect(toPrismaDocType(normalized.pipeline)).toBe("ANNOUNCEMENT");
    expect(toPipelineDocType(normalized.prisma)).toBe("announcement");
  });

  it("未知或空文档类型默认归一化为 notice", () => {
    expect(normalizeDocType(undefined)).toEqual({
      prisma: "NOTICE",
      pipeline: "notice",
    });
    expect(normalizeDocType("not-a-doc-type")).toEqual({
      prisma: "NOTICE",
      pipeline: "notice",
    });
  });
});
