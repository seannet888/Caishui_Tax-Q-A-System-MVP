import { NextResponse } from "next/server";
import { resolveActor, type Actor } from "@/lib/auth/actor";
import { domainErrorToHttp, parseDomainError } from "@/lib/knowledge/domain-error";

type HeaderBearingRequest = Pick<Request, "headers">;
type JsonBearingRequest = Pick<Request, "json">;

export function resolveActorFromRequest(request: HeaderBearingRequest): Actor {
  return resolveActor({
    userId: request.headers.get("x-user-id"),
    userRoles: request.headers.get("x-user-roles"),
    proxySecret: request.headers.get("x-proxy-shared-secret"),
  });
}

export function domainErrorResponse(error: unknown): NextResponse {
  const response = domainErrorToHttp(parseDomainError(error));
  return NextResponse.json(response.body, { status: response.status });
}

export async function readJsonBody<T extends object>(
  request: JsonBearingRequest,
): Promise<Partial<T>> {
  try {
    const body: unknown = await request.json();
    return isRecord(body) ? (body as Partial<T>) : {};
  } catch {
    return {};
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
