import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryRaw } = vi.hoisted(() => ({
  queryRaw: vi.fn(
    async (_template: TemplateStringsArray, ..._values: unknown[]) => [],
  ),
}));

vi.mock("@/lib/db/client", () => ({
  prisma: {
    $queryRaw: queryRaw,
  },
}));

import { searchByVector } from "@/lib/db/queries/chunks";

function renderSql(strings: readonly string[], values: unknown[]): string {
  return strings.reduce((sql, part, index) => {
    const value = values[index] as
      | { strings?: readonly string[]; values?: unknown[] }
      | undefined;
    const renderedValue =
      value?.strings && value.values
        ? renderSql(value.strings, value.values)
        : "";
    return `${sql}${part}${renderedValue}`;
  }, "");
}

describe("searchByVector", () => {
  beforeEach(() => {
    queryRaw.mockClear();
  });

  it("默认应用完整的当前有效性硬过滤", async () => {
    await searchByVector(Array.from({ length: 1024 }, () => 0));

    const call = queryRaw.mock.calls[0];
    expect(call).toBeDefined();
    const [template, ...values] = call!;
    const sql = renderSql(template, values);

    expect(sql).toContain("d.processing_status =");
    expect(sql).toContain("d.retrieval_status =");
    expect(sql).toContain("kc.retrieval_status =");
    expect(sql).toContain("kc.verification_status = 'verified'");
    expect(sql).toContain("kc.embedding_status =");
    expect(sql).toContain("kc.embedding IS NOT NULL");
    expect(sql).toContain("kc.is_current_version = true");
    expect(sql).toContain("kc.effective_date IS NULL OR kc.effective_date <= NOW()");
    expect(sql).toContain("kc.expire_date IS NULL OR kc.expire_date > NOW()");
  });
});
