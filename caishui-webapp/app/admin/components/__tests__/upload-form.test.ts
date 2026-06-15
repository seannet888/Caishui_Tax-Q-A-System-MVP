import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { UploadForm } from "../UploadForm";

describe("UploadForm", () => {
  it("renders a two-panel source intake workspace with preview guidance", () => {
    const html = renderToStaticMarkup(createElement(UploadForm));

    expect(html).toContain("来源文件");
    expect(html).toContain("预览分块");
    expect(html).toContain("上传并清洗");
    expect(html).toContain("清洗预览");
    expect(html).toContain("选择文件并点击预览分块后，这里会显示即将入库的 Chunk。");
    expect(html).toContain("lg:grid-cols-[minmax(0,1fr)_22rem]");
    expect(html).toContain("bg-[color:var(--cs-surface)]");
  });

  it("defaults official-source uploads to trusted auto verification", () => {
    const html = renderToStaticMarkup(createElement(UploadForm));

    expect(html).toContain("可信来源自动核验");
    expect(html).toContain("通过结构检查后自动标记为已核验并触发向量化");
    expect(html).toContain('name="seedVerified"');
    expect(html).toContain("checked");
  });
});
