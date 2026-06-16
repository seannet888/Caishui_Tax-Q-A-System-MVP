"use client";

// 对话窗口：消费 /api/chat 的 SSE 流。
// ⚠️ 禁止在此组件直接 fetch DeepSeek API；所有问答逻辑经 /api/chat → lib/knowledge（铁律二）。

import { MessageBubble } from "./MessageBubble";
import { QueryInput } from "./QueryInput";
import { SourcePanel } from "./SourcePanel";
import { Button } from "@/components/ui/Button";
import { useQaClientSession } from "./qa-client-session";

export function ChatWindow() {
  const { messages, busy, ready, latestCitations, send } =
    useQaClientSession();

  return (
    <div className="grid min-h-[560px] flex-1 gap-4 lg:h-full lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <section className="flex min-h-[560px] flex-1 flex-col overflow-hidden rounded-xl border border-[color:var(--cs-border)] bg-white/[0.86] shadow-[var(--cs-shadow-md)] lg:h-full lg:min-h-0">
        <div className="flex items-center justify-between border-b border-[color:var(--cs-divider)] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[color:var(--cs-primary)] to-[color:var(--cs-cyan)] text-sm font-bold text-white shadow-[0_4px_10px_rgba(0,119,182,0.24)]">
              税
            </div>
            <div>
              <div className="text-base font-semibold text-[color:var(--cs-ink)]">
                税务政策知识助手
              </div>
              <div className="text-xs leading-5 text-[color:var(--cs-muted)]">
                回答由已核验的知识库引用生成，证据不足会明确提示并保留审计快照。
              </div>
            </div>
          </div>
          <span className="hidden rounded-full bg-[color:var(--cs-success-bg)] px-2.5 py-1 text-xs font-medium text-[#1f8a5b] sm:inline-flex">
            知识库已就绪
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-5 py-5">
          {messages.length === 0 ? (
            <EmptyState disabled={busy || !ready} onSend={send} />
          ) : (
            <div className="space-y-4">
              {messages.map((m, i) => (
                <div key={i} className="space-y-2">
                  <MessageBubble
                    role={m.role}
                    content={m.content}
                    status={m.status}
                    meta={m.meta}
                  />
                  {m.role === "assistant" && (
                    <div className="lg:hidden">
                      <SourcePanel presentedCitations={m.citations} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <QueryInput disabled={busy || !ready} onSend={send} />
      </section>
      <div className="hidden min-h-0 lg:flex lg:h-full lg:items-start">
        {latestCitations.length > 0 ? (
          <SourcePanel presentedCitations={latestCitations} desktopRail />
        ) : (
          <EmptyCitationRail />
        )}
      </div>
    </div>
  );
}

function EmptyCitationRail() {
  return (
    <aside className="max-h-full w-full space-y-3 overflow-y-auto overscroll-contain rounded-xl border border-[color:var(--cs-border)] bg-white/[0.86] p-3 text-xs text-[color:var(--cs-muted)] shadow-[var(--cs-shadow-sm)]">
      <div className="flex items-center justify-between gap-3 border-b border-[color:var(--cs-divider)] pb-2">
        <div className="flex items-center gap-2 font-semibold text-[color:var(--cs-ink)]">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#e4f3fb] text-[color:var(--cs-primary)]">
            引
          </span>
          引用来源
        </div>
        <span className="text-[11px] font-medium">0 条</span>
      </div>
      <div className="rounded-xl border border-dashed border-[color:var(--cs-border)] bg-white px-3 py-4 leading-5">
        提交问题并生成答案后，这里会显示回答所依据的不可变引用快照。
      </div>
    </aside>
  );
}

function EmptyState({
  disabled,
  onSend,
}: {
  disabled?: boolean;
  onSend: (question: string) => void;
}) {
  const examples = [
    "小规模纳税人增值税优惠政策现在是否还有效？",
    "研发费用加计扣除的最新政策是什么？",
    "上海社保缴费比例如何查询？",
  ];
  return (
    <div className="flex h-full min-h-[280px] flex-col items-center justify-center px-4 text-center md:min-h-[360px]">
      <div className="max-w-xl">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[color:var(--cs-primary)] text-lg font-semibold text-white shadow-[var(--cs-shadow-sm)]">
          问
        </div>
        <h2 className="mt-4 text-lg font-semibold text-[color:var(--cs-ink)]">
          输入一个需要核对依据的财税问题
        </h2>
        <p className="mt-2 text-sm leading-6 text-[color:var(--cs-muted)]">
          系统会先检索已核验材料，再根据证据充分性决定生成方式；没有证据时不会让模型自由编造。
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
          {examples.map((example) => (
            <Button
              key={example}
              type="button"
              variant="secondary"
              disabled={disabled}
              onClick={() => onSend(example)}
              className="justify-start text-left text-[color:var(--cs-ink)]"
            >
              {example}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
