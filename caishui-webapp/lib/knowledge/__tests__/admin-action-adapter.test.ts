import { describe, expect, it } from "vitest";
import {
  domainErrorResponse,
  readJsonBody,
  resolveActorFromRequest,
} from "@/lib/knowledge/admin-action-adapter";

describe("Admin Action Adapter Module", () => {
  it("resolves actor from a Next.js-like request header adapter", () => {
    process.env.TRUST_PROXY_AUTH = "false";
    process.env.MVP_ACTOR_ID = "reviewer-1";
    process.env.MVP_ACTOR_ROLES = "reviewer";

    const actor = resolveActorFromRequest(
      new Request("http://localhost/api/chunks/chunk-1/verify"),
    );

    expect(actor).toEqual({ id: "reviewer-1", roles: ["reviewer"] });
  });

  it("turns domain errors into stable JSON responses", async () => {
    const response = domainErrorResponse(
      new Error("forbidden_requires_role:admin"),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "forbidden_requires_role",
      detail: "admin",
    });
  });

  it("returns an empty object for invalid JSON bodies", async () => {
    const request = new Request("http://localhost/api/documents/doc-1", {
      method: "POST",
      body: "{",
    });

    await expect(readJsonBody<{ reason?: string }>(request)).resolves.toEqual(
      {},
    );
  });
});
