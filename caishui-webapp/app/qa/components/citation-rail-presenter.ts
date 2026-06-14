import type { PresentedCitation } from "@/lib/knowledge/citation-presentation";
import type { QaMessage } from "./history-hydration";

export function selectLatestAssistantCitations(
  messages: QaMessage[],
): PresentedCitation[] {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== "assistant") continue;
    if (message.citations && message.citations.length > 0) {
      return message.citations;
    }
  }
  return [];
}
