import type { Actor } from "@/lib/auth/actor";
import { requestPipeline } from "@/lib/pipeline/http-client";

export async function getPipelineStatus(input: {
  actor: Actor;
  taskId: string;
}): Promise<{ data: unknown; status: number }> {
  const path = `/status/${encodeURIComponent(input.taskId)}`;
  const response = await requestPipeline({
    actor: input.actor,
    method: "GET",
    path,
  });
  return {
    data: response.data,
    status: response.status,
  };
}
