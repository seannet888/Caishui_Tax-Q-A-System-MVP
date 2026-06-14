import { describe, expect, it } from "vitest";
import {
  detectTemporalIntent,
  parseQueryDate,
} from "@/lib/knowledge/temporal";

describe("detectTemporalIntent", () => {
  it("现在是否有效 → current_validity", () => {
    expect(detectTemporalIntent("财税〔2023〕1号现在是否有效？")).toBe(
      "current_validity",
    );
  });

  it("默认问题 → current_applicability", () => {
    expect(detectTemporalIntent("研发费用加计扣除政策是什么？")).toBe(
      "current_applicability",
    );
  });

  it("含往年年份的对比 → historical_comparison", () => {
    expect(detectTemporalIntent("2023年和现在有什么变化？")).toBe(
      "historical_comparison",
    );
  });

  it("含往年年份不等于历史查询（不应误判为移除时效）", () => {
    // 现在是否有效，含 2023 年份，仍应判为 current_validity
    expect(detectTemporalIntent("财税〔2023〕1号现在还执行吗？")).toBe(
      "current_validity",
    );
  });
});

describe("parseQueryDate", () => {
  it("拒绝格式正确但日历中不存在的日期", () => {
    expect(() => parseQueryDate("2024-02-31")).toThrow("invalid_query_date");
  });
});
