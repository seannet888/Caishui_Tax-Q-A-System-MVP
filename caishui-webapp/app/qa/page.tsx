import { ChatWindow } from "./components/ChatWindow";

export default function QaPage() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-6.75rem)] w-full max-w-7xl flex-col gap-5">
      <header className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-medium text-[color:var(--cs-primary)]">
            Tax policy knowledge assistant
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.01em] text-[color:var(--cs-ink)]">
            税务政策智能问答
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--cs-muted)]">
            基于已核验的知识库引用生成答案。遇到证据不足或来源失效时，会明确提示并保留审计快照。
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-[color:var(--cs-border)] bg-white px-3 py-1 text-[color:var(--cs-muted)]">
            默认过滤未核验内容
          </span>
          <span className="rounded-full border border-[color:var(--cs-border)] bg-white px-3 py-1 text-[color:var(--cs-muted)]">
            未检索到 ≠ 未出台
          </span>
        </div>
      </header>
      <ChatWindow />
    </div>
  );
}
