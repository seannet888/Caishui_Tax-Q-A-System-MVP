import { describe, expect, it } from "vitest";
import { buildQueryPlan } from "@/lib/knowledge/query-plan";

describe("buildQueryPlan", () => {
  it("默认执行当前有效检索并按生效日期排序", () => {
    const plan = buildQueryPlan({ query: "研发费用加计扣除政策是什么？" });

    expect(plan.executions).toEqual([
      { id: "primary", temporalScope: "current" },
    ]);
    expect(plan.rankingMode).toBe("effective_date");
  });

  it("最新发布放宽失效过滤并要求标注效力", () => {
    const plan = buildQueryPlan({ query: "最新发布的增值税政策" });

    expect(plan.latestIntent).toBe("latest_publication");
    expect(plan.executions).toEqual([
      { id: "primary", temporalScope: "unbounded" },
    ]);
    expect(plan.rankingMode).toBe("publish_date");
    expect(plan.effectivityLabelRequired).toBe(true);
  });

  it("发布期间生成完整年份区间", () => {
    const plan = buildQueryPlan({ query: "2023年发布了哪些增值税政策？" });

    expect(plan.executions).toEqual([
      {
        id: "primary",
        temporalScope: "publication_period",
        publicationStart: "2023-01-01",
        publicationEnd: "2023-12-31",
      },
    ]);
  });

  it("历史比较生成历史与当前两次执行", () => {
    const plan = buildQueryPlan({ query: "2023年和现在有什么变化？" });

    expect(plan.executions).toEqual([
      { id: "historical", temporalScope: "as_of", asOf: "2023-12-31" },
      { id: "current", temporalScope: "current" },
    ]);
  });

  it("最新解读限定解读材料并按发布日期排序", () => {
    const plan = buildQueryPlan({ query: "研发费用最新解读" });

    expect(plan.docTypeFilter).toBe("interpretation");
    expect(plan.rankingMode).toBe("publish_date");
  });
});
