import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import AdminPage from "../../page";
import UploadPage from "../../upload/page";

describe("admin pages", () => {
  it("renders the admin hub as a calm governance workspace", () => {
    const html = renderToStaticMarkup(createElement(AdminPage));

    expect(html).toContain("后台管理");
    expect(html).toContain("上传文档");
    expect(html).toContain("文档治理");
    expect(html).toContain("治理工作台");
    expect(html).toContain("rounded-xl");
    expect(html).toContain("bg-[color:var(--cs-surface)]");
  });

  it("renders the upload page with source intake context", () => {
    const html = renderToStaticMarkup(createElement(UploadPage));

    expect(html).toContain("上传来源文档");
    expect(html).toContain("Source intake");
    expect(html).toContain("先预览，再清洗入库");
    expect(html).toContain("max-w-7xl");
  });
});
