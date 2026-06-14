import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DocsPageHeader } from "../DocsPageHeader";

describe("DocsPageHeader", () => {
  it("renders the document governance workspace context and upload action", () => {
    const html = renderToStaticMarkup(createElement(DocsPageHeader));

    expect(html).toContain("文档治理");
    expect(html).toContain("上传来源文档");
    expect(html).toContain("/admin/upload");
    expect(html).toContain("处理状态");
    expect(html).toContain("检索状态");
    expect(html).toContain("审计保留");
    expect(html).toContain("bg-[color:var(--cs-surface)]");
  });
});
