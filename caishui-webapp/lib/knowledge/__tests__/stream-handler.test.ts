import { describe, expect, it } from "vitest";
import { parseDeepSeekStream } from "@/lib/knowledge/stream-handler";

describe("parseDeepSeekStream", () => {
  it("解析跨网络块拆分的 DeepSeek SSE 并在 DONE 停止", async () => {
    const source = async function* () {
      yield Buffer.from('data: {"choices":[{"delta":{"content":"财税');
      yield Buffer.from('政策"}}]}\n\ndata: {"choices":[{"delta":{"content":"依据"}}]}\n');
      yield Buffer.from("\ndata: [DONE]\n\ndata: {\"choices\":[{\"delta\":{\"content\":\"忽略\"}}]}\n\n");
    };
    const deltas = [];

    for await (const delta of parseDeepSeekStream(source())) {
      deltas.push(delta);
    }

    expect(deltas).toEqual(["财税政策", "依据"]);
  });

  it("上游在 DONE 前结束时拒绝把残缺流视为完成", async () => {
    const source = async function* () {
      yield Buffer.from(
        'data: {"choices":[{"delta":{"content":"尚未完成的答案"}}]}\n\n',
      );
    };

    const consume = async () => {
      for await (const _delta of parseDeepSeekStream(source())) {
        // 消费整个流，最终状态由公开接口决定。
      }
    };

    await expect(consume()).rejects.toThrow("deepseek_stream_missing_done");
  });
});
