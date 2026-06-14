import { beforeEach, describe, expect, it } from "vitest";
import { resolveActor } from "@/lib/auth/actor";

describe("resolveActor", () => {
  beforeEach(() => {
    delete process.env.PROXY_SHARED_SECRET;
    process.env.TRUST_PROXY_AUTH = "false";
    process.env.MVP_ACTOR_ID = "local-viewer";
    process.env.MVP_ACTOR_ROLES = "viewer";
  });

  it("ignores spoofed user headers when proxy auth is disabled", () => {
    expect(
      resolveActor({
        userId: "attacker",
        userRoles: "admin",
      }),
    ).toEqual({ id: "local-viewer", roles: ["viewer"] });
  });

  it("requires a configured proxy shared secret when proxy auth is enabled", () => {
    process.env.TRUST_PROXY_AUTH = "true";

    expect(() =>
      resolveActor({
        userId: "admin-1",
        userRoles: "admin",
      }),
    ).toThrow("proxy_auth_secret_not_configured");
  });

  it("rejects proxy actor headers without the matching shared secret", () => {
    process.env.TRUST_PROXY_AUTH = "true";
    process.env.PROXY_SHARED_SECRET = "proxy-secret";

    expect(() =>
      resolveActor({
        userId: "admin-1",
        userRoles: "admin",
        proxySecret: "wrong-secret",
      }),
    ).toThrow("proxy_auth_secret_mismatch");
  });

  it("accepts proxy actor headers with the matching shared secret", () => {
    process.env.TRUST_PROXY_AUTH = "true";
    process.env.PROXY_SHARED_SECRET = "proxy-secret";

    expect(
      resolveActor({
        userId: "admin-1",
        userRoles: "admin,reviewer",
        proxySecret: "proxy-secret",
      }),
    ).toEqual({ id: "admin-1", roles: ["admin", "reviewer"] });
  });
});
