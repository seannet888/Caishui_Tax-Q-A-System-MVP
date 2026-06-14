import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { APP_NAV_ITEMS } from "./navigation";

export function NavigationLinks({
  activeHref,
  variant,
}: {
  activeHref: string;
  variant: "sidebar" | "mobile";
}) {
  if (variant === "mobile") {
    return (
      <nav aria-label="主导航" className="flex gap-2 overflow-x-auto pb-1 md:hidden">
        {APP_NAV_ITEMS.map((item) => {
          const active = item.href === activeHref;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-[color:var(--cs-primary)]",
                active
                  ? "border-[color:var(--cs-primary)] bg-[#e7f4fb] text-[color:var(--cs-primary-dark)]"
                  : "border-[color:var(--cs-border)] bg-white text-[color:var(--cs-muted)] hover:border-[color:var(--cs-primary)]",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav
      aria-label="主导航"
      className="hidden w-56 shrink-0 border-r border-[color:var(--cs-border)] bg-white/[0.62] p-3 text-sm backdrop-blur md:block"
    >
      <ul className="space-y-1.5">
        {APP_NAV_ITEMS.map((item) => {
          const active = item.href === activeHref;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block rounded-lg px-3 py-2 transition focus:outline-none focus:ring-2 focus:ring-[color:var(--cs-primary)] focus:ring-offset-2 focus:ring-offset-transparent",
                  active
                    ? "bg-white text-[color:var(--cs-primary-dark)] shadow-[var(--cs-shadow-sm)]"
                    : "text-[color:var(--cs-ink)] hover:bg-white hover:shadow-[var(--cs-shadow-sm)]",
                )}
              >
                <span className="block font-medium">{item.label}</span>
                <span className="mt-0.5 block text-xs text-[color:var(--cs-muted)]">
                  {item.description}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
