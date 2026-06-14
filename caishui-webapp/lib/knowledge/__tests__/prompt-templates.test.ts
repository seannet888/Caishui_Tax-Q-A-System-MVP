import { describe, expect, it } from "vitest";
import {
  buildTaxPrompt,
  PROMPT_TEMPLATE_VERSION,
} from "@/lib/knowledge/prompt-templates";
import type { QueryPlan, RetrievedEvidence } from "@/types/knowledge";

const evidence: RetrievedEvidence = {
  id: "chunk-1",
  document_id: "doc-1",
  content: "本公告自发布之日起施行。",
  content_hash: "a".repeat(64),
  chunk_type: "text",
  similarity: 0.9,
  distance: 0.1,
  title: "测试公告",
  source_document_name: "测试公告.pdf",
  doc_number: "国家税务总局公告2024年第1号",
  publish_date: "2024-01-01T00:00:00.000Z",
  effective_date: "2024-01-01T00:00:00.000Z",
  provision_type: "operative",
  retrieval_execution: "primary",
};

const latestPublicationPlan: QueryPlan = {
  temporalIntent: "current_applicability",
  latestIntent: "latest_publication",
  executions: [{ id: "primary", temporalScope: "unbounded" }],
      rankingMode: "publish_date",
      effectivityLabelRequired: true,
      strictDateOrdering: true,
};

describe("buildTaxPrompt", () => {
  it("uses an audit version that reflects citation-marker prompt hardening", () => {
    expect(PROMPT_TEMPLATE_VERSION).toBe("v1.1");
  });

  it("注入真实证据字段、检索分支和计划透明性", () => {
    const prompt = buildTaxPrompt(
      [evidence],
      "最新发布的政策",
      {
        sourcesHit: [],
        dateRange: {},
        documentTypesHit: [],
        globalSourceHealth: [],
      },
      latestPublicationPlan,
    );

    expect(prompt).toContain("分支：primary");
    expect(prompt).toContain("发布：2024-01-01");
    expect(prompt).toContain("排序：publish_date");
    expect(prompt).toContain("逐条标明材料");
  });

  it("强制模型使用与参考资料编号一致的引用标记", () => {
    const prompt = buildTaxPrompt(
      [evidence],
      "测试公告什么时候生效？",
      {
        sourcesHit: ["国家税务总局官网"],
        dateRange: { min: "2024-01-01", max: "2024-01-01" },
        documentTypesHit: ["notice"],
        globalSourceHealth: [],
      },
      latestPublicationPlan,
    );

    expect(prompt).toContain("必须使用参考资料编号格式「[1]」");
    expect(prompt).toContain("每个事实性结论句末都必须至少包含一个引用标记");
    expect(prompt).toContain("不得引用不存在的编号");
  });
});
