export interface AppNavItem {
  href: string;
  label: string;
  description: string;
}

export const APP_NAV_ITEMS: AppNavItem[] = [
  { href: "/qa", label: "问答", description: "生成与引用" },
  { href: "/docs", label: "文档治理", description: "来源与 Chunk" },
  { href: "/admin", label: "后台", description: "状态与治理" },
  { href: "/admin/upload", label: "上传", description: "预览与入库" },
];

export function getActiveNavigationHref(pathname: string): string {
  const normalized = normalizePathname(pathname);
  const matched = APP_NAV_ITEMS.filter((item) =>
    normalized === item.href || normalized.startsWith(`${item.href}/`),
  ).sort((a, b) => b.href.length - a.href.length);
  return matched[0]?.href ?? "/qa";
}

function normalizePathname(pathname: string): string {
  const [pathOnly] = pathname.split(/[?#]/);
  if (!pathOnly || pathOnly === "/") return "/qa";
  return pathOnly.endsWith("/") && pathOnly.length > 1
    ? pathOnly.slice(0, -1)
    : pathOnly;
}
