// lib/knowledge/coverage.ts
// Global Coverage Scope：系统级声明，背景信息，不能单独作为「未出台」结论的依据。

export const GLOBAL_COVERAGE = {
  sources: [
    { name: "国家税务总局官网", url: "https://www.chinatax.gov.cn" },
    { name: "财政部官网", url: "https://www.mof.gov.cn" },
    { name: "国务院政策文件库", url: "https://www.gov.cn/zhengce" },
  ],
  dateRange: { start: process.env.COVERAGE_START_DATE ?? "2000-01-01" },
  documentTypes: ["公告", "通知", "条例", "办法", "解读"],
  disclaimer: "知识库覆盖上述来源截至声明日期的已收录材料，但不保证全覆盖。",
};

export const GLOBAL_SOURCE_HEALTH = [
  {
    name: "国家税务总局官网",
    status: "active",
    lastSuccessfulSync: process.env.CHINATAX_LAST_SUCCESSFUL_SYNC ?? null,
  },
  {
    name: "财政部官网",
    status: "active",
    lastSuccessfulSync: process.env.MOF_LAST_SUCCESSFUL_SYNC ?? null,
  },
  {
    name: "国务院政策文件库",
    status: "active",
    lastSuccessfulSync: process.env.GOVCN_LAST_SUCCESSFUL_SYNC ?? null,
  },
] as const;

function deriveCoverageEnd(
  sourceHealth: typeof GLOBAL_SOURCE_HEALTH,
): string | null {
  const activeSyncDates = sourceHealth
    .filter((source) => source.status === "active" && source.lastSuccessfulSync)
    .map((source) => source.lastSuccessfulSync as string)
    .sort();
  // 全局可声明的截止日期不能晚于最旧的健康来源同步日期。
  return activeSyncDates[0] ?? null;
}

export function formatGlobalCoverage(
  scope: typeof GLOBAL_COVERAGE = GLOBAL_COVERAGE,
  sourceHealth = GLOBAL_SOURCE_HEALTH,
): string {
  const coverageEnd = deriveCoverageEnd(sourceHealth);
  return [
    `计划覆盖来源：${scope.sources.map((s) => s.name).join("、")}`,
    `计划覆盖时间：${scope.dateRange.start} 至 ${coverageEnd ?? "尚未形成可靠截止日期"}`,
    `计划覆盖类型：${scope.documentTypes.join("、")}`,
    `说明：${scope.disclaimer}`,
  ].join("\n");
}
