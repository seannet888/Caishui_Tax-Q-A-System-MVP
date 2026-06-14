"use client";

import { usePathname } from "next/navigation";
import { NavigationLinks } from "./NavigationLinks";
import { getActiveNavigationHref } from "./navigation";

export function TopNav() {
  const pathname = usePathname();
  const activeHref = getActiveNavigationHref(pathname);

  return (
    <header className="z-10 shrink-0 border-b border-[color:var(--cs-border)] bg-white/[0.86] px-4 py-3 text-sm backdrop-blur md:px-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[color:var(--cs-primary)] text-sm font-semibold text-white shadow-[var(--cs-shadow-sm)]">
            税
          </div>
          <div className="min-w-0">
            <div className="truncate font-semibold leading-5 text-[color:var(--cs-ink)]">
              财税知识库问答
            </div>
            <div className="truncate text-xs text-[color:var(--cs-muted)]">
              Verified policy Q&A workspace
            </div>
          </div>
        </div>
        <div className="hidden items-center gap-2 rounded-full border border-[color:var(--cs-border)] bg-white px-3 py-1 text-xs text-[color:var(--cs-muted)] md:flex">
          <span className="h-2 w-2 rounded-full bg-[color:var(--cs-success)]" />
          MVP 本地工作台
        </div>
      </div>
      <div className="mt-3 md:hidden">
        <NavigationLinks activeHref={activeHref} variant="mobile" />
      </div>
    </header>
  );
}
