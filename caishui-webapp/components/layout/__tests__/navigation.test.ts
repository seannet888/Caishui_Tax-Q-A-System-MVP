import { describe, expect, it } from "vitest";
import { APP_NAV_ITEMS, getActiveNavigationHref } from "../navigation";

describe("app navigation model", () => {
  it("defines the main workspace routes in one shared contract", () => {
    expect(APP_NAV_ITEMS.map((item) => item.href)).toEqual([
      "/qa",
      "/docs",
      "/admin",
      "/admin/upload",
    ]);
  });

  it("selects the deepest matching route as active", () => {
    expect(getActiveNavigationHref("/qa")).toBe("/qa");
    expect(getActiveNavigationHref("/docs/doc-1")).toBe("/docs");
    expect(getActiveNavigationHref("/admin")).toBe("/admin");
    expect(getActiveNavigationHref("/admin/upload")).toBe("/admin/upload");
    expect(getActiveNavigationHref("/admin/upload?step=preview")).toBe(
      "/admin/upload",
    );
  });

  it("falls back to QA for the root workspace route", () => {
    expect(getActiveNavigationHref("/")).toBe("/qa");
  });
});
