import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button } from "../Button";

describe("Button", () => {
  it("renders the primary action vocabulary with disabled and custom classes", () => {
    const html = renderToStaticMarkup(
      createElement(
        Button,
        {
          type: "submit",
          variant: "primary",
          size: "sm",
          disabled: true,
          className: "w-full",
        },
        "上传并清洗",
      ),
    );

    expect(html).toContain("type=\"submit\"");
    expect(html).toContain("disabled=\"\"");
    expect(html).toContain("上传并清洗");
    expect(html).toContain("bg-[color:var(--cs-primary-dark)]");
    expect(html).toContain("px-3");
    expect(html).toContain("w-full");
  });

  it("renders warning actions with the warning semantic palette", () => {
    const html = renderToStaticMarkup(
      createElement(Button, { variant: "warning", size: "sm" }, "撤出检索"),
    );

    expect(html).toContain("撤出检索");
    expect(html).toContain("bg-[color:var(--cs-warning)]");
    expect(html).toContain("text-white");
  });
});
