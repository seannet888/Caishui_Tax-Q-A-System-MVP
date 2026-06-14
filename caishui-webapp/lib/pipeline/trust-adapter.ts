// Authenticated WebApp -> data-pipeline request boundary.

import { createHmac } from "node:crypto";
import type { Actor } from "@/lib/auth/actor";

const AUTH_VERSION = "v1";

export function signPipelineRequest(input: {
  method: string;
  path: string;
  actor: Actor;
  timestamp?: number;
  secret?: string;
}): Record<string, string> {
  const secret = input.secret ?? process.env.PIPELINE_SHARED_SECRET;
  if (!secret) throw new Error("pipeline_auth_not_configured");

  const timestamp = String(input.timestamp ?? Math.floor(Date.now() / 1000));
  const roles = [...input.actor.roles].sort().join(",");
  const message = [
    AUTH_VERSION,
    timestamp,
    input.method.toUpperCase(),
    input.path,
    input.actor.id,
    roles,
  ].join("\n");
  const signature = createHmac("sha256", secret).update(message).digest("hex");

  return {
    "X-Pipeline-Auth-Version": AUTH_VERSION,
    "X-Pipeline-Timestamp": timestamp,
    "X-Pipeline-Actor-ID": input.actor.id,
    "X-Pipeline-Actor-Roles": roles,
    "X-Pipeline-Signature": signature,
  };
}
