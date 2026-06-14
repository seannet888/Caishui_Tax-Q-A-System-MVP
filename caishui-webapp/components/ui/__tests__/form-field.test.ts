import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { controlClassName, Field } from "../FormField";

describe("Field", () => {
  it("renders compact product labels and exposes the shared control class", () => {
    const html = renderToStaticMarkup(
      createElement(
        Field,
        { label: "来源渠道", required: true },
        createElement("input", {
          name: "sourceChannel",
          className: controlClassName,
        }),
      ),
    );

    expect(html).toContain("来源渠道");
    expect(html).toContain("*");
    expect(html).toContain("name=\"sourceChannel\"");
    expect(controlClassName).toContain("focus:border-[color:var(--cs-primary)]");
    expect(controlClassName).toContain("placeholder:text-[color:var(--cs-muted-2)]");
  });
});
