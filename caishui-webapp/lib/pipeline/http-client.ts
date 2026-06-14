import type { Actor } from "@/lib/auth/actor";
import { parsePipelineResponseBody } from "@/lib/pipeline/response";
import { signPipelineRequest } from "@/lib/pipeline/trust-adapter";

export interface PipelineHttpResponse {
  ok: boolean;
  status: number;
  data: unknown;
}

export async function requestPipeline(input: {
  actor: Actor;
  method: "GET" | "POST";
  path: string;
  body?: BodyInit;
}): Promise<PipelineHttpResponse> {
  const pipelineUrl = process.env.DATA_PIPELINE_URL ?? "http://localhost:8000";
  const init: RequestInit = {
    headers: signPipelineRequest({
      method: input.method,
      path: input.path,
      actor: input.actor,
    }),
  };
  if (input.method !== "GET") init.method = input.method;
  if (input.body) init.body = input.body;

  let response: Response;
  try {
    response = await fetch(`${pipelineUrl}${input.path}`, init);
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: `network_error:${formatTransportError(error)}`,
    };
  }

  return {
    ok: response.ok,
    status: response.status,
    data: parsePipelineResponseBody(await response.text()),
  };
}

function formatTransportError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return String(error);
}
