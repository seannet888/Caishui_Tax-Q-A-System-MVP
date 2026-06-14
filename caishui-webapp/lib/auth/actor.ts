// lib/auth/actor.ts
// MVP 身份与角色（最小权限模型）。管理员身份不自动获得人工核验权限。
// 本地开发用环境变量；部署环境只信任内网反向代理注入的 X-User-ID / X-User-Roles。
// 禁止在公网直接信任客户端传入的身份头。

export type Role = "viewer" | "reviewer" | "admin";

export interface Actor {
  id: string;
  roles: Role[];
}

const VALID_ROLES: Role[] = ["viewer", "reviewer", "admin"];

function parseRoles(raw: string | undefined): Role[] {
  return (raw ?? "")
    .split(",")
    .map((r) => r.trim())
    .filter((r): r is Role => (VALID_ROLES as string[]).includes(r));
}

// 信任边界必须是显式 opt-in（默认 false）。否则一个暴露在公网或代理配置错误的
// 部署会直接信任客户端伪造的 X-User-Roles: admin，造成权限提升（confused deputy）。
function trustProxyAuth(): boolean {
  return process.env.TRUST_PROXY_AUTH === "true";
}

/**
 * 解析当前 actor。
 * - 默认（TRUST_PROXY_AUTH !== "true"）：忽略所有 X-User-* 头，使用 MVP_ACTOR_ID /
 *   MVP_ACTOR_ROLES。任何混入的客户端头都不可能提权。
 * - 仅当 TRUST_PROXY_AUTH === "true"（部署在受信任内网代理之后，且代理已剥离客户端
 *   自带的同名头）才信任 headers。此时 PROXY_SHARED_SECRET 必须配置，且代理必须注入
 *   匹配的 X-Proxy-Shared-Secret。
 */
export function resolveActor(headers?: {
  userId?: string | null;
  userRoles?: string | null;
  proxySecret?: string | null;
}): Actor {
  if (!trustProxyAuth()) {
    const roles = parseRoles(process.env.MVP_ACTOR_ROLES);
    return {
      id: process.env.MVP_ACTOR_ID || "local-dev",
      roles: roles.length ? roles : ["viewer"],
    };
  }

  const expectedProxySecret = process.env.PROXY_SHARED_SECRET;
  if (!expectedProxySecret) {
    throw new Error("proxy_auth_secret_not_configured");
  }
  if (headers?.proxySecret !== expectedProxySecret) {
    throw new Error("proxy_auth_secret_mismatch");
  }

  const id = headers?.userId?.trim();
  if (!id) {
    throw new Error("proxy_auth_enabled_but_user_id_missing");
  }
  const roles = parseRoles(headers?.userRoles ?? undefined);
  return { id, roles: roles.length ? roles : ["viewer"] };
}

export function hasRole(actor: Actor, role: Role): boolean {
  return actor.roles.includes(role);
}

export function requireRole(actor: Actor, role: Role): void {
  if (!hasRole(actor, role)) {
    throw new Error(`forbidden_requires_role:${role}`);
  }
}
