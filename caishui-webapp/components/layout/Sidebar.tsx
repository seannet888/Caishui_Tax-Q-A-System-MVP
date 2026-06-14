"use client";

import { usePathname } from "next/navigation";
import { NavigationLinks } from "./NavigationLinks";
import { getActiveNavigationHref } from "./navigation";

export function Sidebar() {
  const pathname = usePathname();
  return (
    <NavigationLinks
      activeHref={getActiveNavigationHref(pathname)}
      variant="sidebar"
    />
  );
}
