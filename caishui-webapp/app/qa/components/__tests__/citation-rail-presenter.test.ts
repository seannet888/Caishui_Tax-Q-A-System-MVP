import { describe, expect, it } from "vitest";
import { selectLatestAssistantCitations } from "../citation-rail-presenter";
import type { QaMessage } from "../history-hydration";

describe("selectLatestAssistantCitations", () => {
  it("selects the newest assistant citation set and ignores user messages", () => {
    const messages = [
      { role: "assistant", content: "旧答案", citations: [{ id: "old" }] },
      { role: "user", content: "追问", citations: [{ id: "user" }] },
      { role: "assistant", content: "新答案", citations: [{ id: "new" }] },
    ] as QaMessage[];

    expect(selectLatestAssistantCitations(messages)).toEqual([{ id: "new" }]);
  });

  it("returns an empty list when no assistant answer has citations", () => {
    expect(
      selectLatestAssistantCitations([
        { role: "user", content: "问题" },
        { role: "assistant", content: "无证据答案", citations: [] },
      ] as QaMessage[]),
    ).toEqual([]);
  });
});
