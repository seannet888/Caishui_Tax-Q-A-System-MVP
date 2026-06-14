export function parsePipelineResponseBody(text: string): unknown {
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function formatPipelineError(raw: unknown): string {
  if (typeof raw === "string") return raw;
  return JSON.stringify(raw);
}
