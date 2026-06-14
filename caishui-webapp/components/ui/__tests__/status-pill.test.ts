import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StatusPill } from "../StatusPill";

describe("StatusPill", () => {
  it("renders semantic tone classes without relying on color alone", () => {
    const html = renderToStaticMarkup(
      createElement(StatusPill, { tone: "warning" }, "WITHDRAWN"),
    );

    expect(html).toContain("WITHDRAWN");
    expect(html).toContain("bg-[color:var(--cs-warning-bg)]");
    expect(html).toContain("text-[color:var(--cs-warning)]");
    expect(html).toContain("rounded");
  });
});
