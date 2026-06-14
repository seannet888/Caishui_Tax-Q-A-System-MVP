import type {
  ProviderConnectivityCheckResult,
  ProviderConnectivitySmokeResult,
} from "@/lib/smoke/provider-connectivity";

export type ProviderFailureClassification =
  | "auth_failed"
  | "network_timeout"
  | "embedding_shape_mismatch"
  | "stream_incomplete"
  | "missing_response"
  | "unknown";

export function classifyProviderFailure(
  reason: string,
): ProviderFailureClassification {
  const normalized = reason.toLowerCase();
  if (
    normalized.includes("status code 401") ||
    normalized.includes("status code 403") ||
    normalized.includes("unauthorized") ||
    normalized.includes("forbidden")
  ) {
    return "auth_failed";
  }
  if (
    normalized.includes("timeout") ||
    normalized.includes("etimedout") ||
    normalized.includes("econnrefused") ||
    normalized.includes("enotfound")
  ) {
    return "network_timeout";
  }
  if (
    normalized.includes("embedding_dimension_mismatch") ||
    normalized.includes("embedding_missing")
  ) {
    return "embedding_shape_mismatch";
  }
  if (normalized.includes("deepseek_stream_missing_done")) {
    return "stream_incomplete";
  }
  if (normalized.includes("empty") || normalized.includes("missing")) {
    return "missing_response";
  }
  return "unknown";
}

export function formatProviderConnectivityResult(
  result: ProviderConnectivitySmokeResult,
): string {
  if (!result.ok) return formatProviderConnectivityFailure(result);
  return [
    "Provider connectivity smoke passed",
    ...result.checks.map(formatSuccessfulCheck),
  ].join("\n");
}

export function formatProviderConnectivityFailure(
  result: ProviderConnectivitySmokeResult,
): string {
  const failed = result.checks.filter((check) => !check.ok);
  return [
    "Provider connectivity smoke failed",
    ...result.checks.map(formatCheckLine),
    ...failed.map(formatActionLine),
  ].join("\n");
}

function formatSuccessfulCheck(check: ProviderConnectivityCheckResult): string {
  if (!check.ok) return formatCheckLine(check);
  if (check.name === "embedding") {
    return `${check.provider} embedding: ok, model=${check.model}, dimension=${check.dimension}`;
  }
  return `${check.provider} chat: ok, model=${check.model}, receivedText=${JSON.stringify(check.receivedText)}`;
}

function formatCheckLine(check: ProviderConnectivityCheckResult): string {
  if (check.ok) return formatSuccessfulCheck(check);
  const classification = classifyProviderFailure(check.reason);
  return `${check.name}: failed, provider=${check.provider}, model=${check.model}, classification=${classification}, reason=${check.reason}`;
}

function formatActionLine(check: ProviderConnectivityCheckResult): string {
  if (check.ok) return "";
  const classification = classifyProviderFailure(check.reason);
  if (check.name === "embedding" && classification === "auth_failed") {
    return "Action: Check EMBEDDING_API_KEY, EMBEDDING_BASE_URL, and SiliconFlow account quota.";
  }
  if (check.name === "chat" && classification === "auth_failed") {
    return "Action: Check DEEPSEEK_API_KEY and DeepSeek account quota.";
  }
  if (classification === "network_timeout") {
    return "Action: Check local network, DNS/proxy settings, provider availability, and timeout logs.";
  }
  if (classification === "embedding_shape_mismatch") {
    return "Action: Check EMBEDDING_MODEL is BAAI/bge-large-zh-v1.5 and still returns 1024 dimensions.";
  }
  if (classification === "stream_incomplete") {
    return "Action: Check DeepSeek streaming stability; response ended before [DONE].";
  }
  if (classification === "missing_response") {
    return "Action: Check provider response body and client parsing assumptions.";
  }
  return "Action: Inspect the provider raw error and service status page.";
}
