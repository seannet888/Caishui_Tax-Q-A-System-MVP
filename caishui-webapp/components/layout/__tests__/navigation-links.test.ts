import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NavigationLinks } from "../NavigationLinks";

describe("NavigationLinks", () => {
  it("renders desktop workspace navigation with an accessible active item", () => {
    const html = renderToStaticMarkup(
      createElement(NavigationLinks, {
        activeHref: "/docs",
        variant: "sidebar",
      }),
    );

    expect(html).toContain('aria-label="主导航"');
    expect(html).toContain('href="/qa"');
    expect(html).toContain('href="/docs"');
    expect(html).toContain('href="/admin"');
    expect(html).toContain('href="/admin/upload"');
    expect(html).toContain('href="/docs"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("文档治理");
    expect(html).toContain("来源与 Chunk");
  });

  it("renders compact mobile navigation from the same route contract", () => {
    const html = renderToStaticMarkup(
      createElement(NavigationLinks, {
        activeHref: "/admin/upload",
        variant: "mobile",
      }),
    );

    expect(html).toContain("md:hidden");
    expect(html).toContain('href="/admin/upload"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("问答");
    expect(html).toContain("文档治理");
    expect(html).toContain("后台");
    expect(html).toContain("上传");
  });
});
