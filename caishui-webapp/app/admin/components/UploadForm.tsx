"use client";

import Link from "next/link";
import React, { useState } from "react";
import { Button } from "@/components/ui/Button";
import { controlClassName, Field } from "@/components/ui/FormField";
import type { ChunkOutput } from "@/types/pipeline";
import { ChunkPreview } from "./ChunkPreview";
import { PipelineStatus } from "./PipelineStatus";
import { presentUploadFailure } from "./upload-response-presenter";

export function UploadForm() {
  const [taskId, setTaskId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewChunks, setPreviewChunks] = useState<ChunkOutput[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [failedDocumentId, setFailedDocumentId] = useState<string | null>(null);
  const [busy, setBusy] = useState<"upload" | "preview" | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setFailedDocumentId(null);
    setBusy("upload");
    try {
      const form = new FormData(e.currentTarget);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        const failure = presentUploadFailure(data);
        setFailedDocumentId(failure.failedDocumentId);
        throw new Error(failure.message);
      }
      setTaskId(data.task_id);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(null);
    }
  };

  const onPreview = async (e: React.MouseEvent<HTMLButtonElement>) => {
    const formElement = e.currentTarget.form;
    if (!formElement) return;
    setError(null);
    setFailedDocumentId(null);
    setBusy("preview");
    try {
      const form = new FormData(formElement);
      const res = await fetch("/api/pipeline/preview", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "preview_failed");
      setPreviewId(data.previewId);
      setPreviewChunks(data.output.chunks ?? []);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <form
        onSubmit={onSubmit}
        className="rounded-xl border border-[color:var(--cs-border)] bg-[color:var(--cs-surface)] p-5 shadow-[var(--cs-shadow-sm)]"
      >
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-[color:var(--cs-divider)] pb-4">
          <div>
            <h2 className="text-base font-semibold text-[color:var(--cs-ink)]">
              来源文档信息
            </h2>
            <p className="mt-1 max-w-xl text-sm leading-6 text-[color:var(--cs-muted)]">
              先确认来源、发文机关和时效字段，再预览分块质量或触发清洗任务。
            </p>
          </div>
          <span className="rounded-full bg-[#e7f4fb] px-3 py-1 text-xs font-medium text-[color:var(--cs-primary-dark)]">
            verified chunks only
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="md:col-span-2">
            <span className="mb-1 block text-xs font-medium text-[color:var(--cs-muted)]">
              来源文件
            </span>
            <input
              type="file"
              name="file"
              accept=".pdf,.md,.xlsx,.csv"
              required
              className="block w-full rounded-lg border border-[color:var(--cs-border)] bg-white px-3 py-2 text-sm text-[color:var(--cs-ink)] file:mr-3 file:rounded-md file:border-0 file:bg-[color:var(--cs-success-bg)] file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-[#1f8a5b] focus:outline-none focus:ring-2 focus:ring-[color:var(--cs-primary)]"
            />
          </label>
          <Field label="文档标题">
            <input
              type="text"
              name="title"
              placeholder="可选"
              className={controlClassName}
            />
          </Field>
          <Field label="来源渠道" required>
            <input
              type="text"
              name="sourceChannel"
              placeholder="国家税务总局官网"
              required
              className={controlClassName}
            />
          </Field>
          <Field label="发文机关">
            <input
              type="text"
              name="issuingBody"
              placeholder="可选"
              className={controlClassName}
            />
          </Field>
          <Field label="管辖地">
            <input
              type="text"
              name="jurisdiction"
              placeholder="全国、上海市"
              className={controlClassName}
            />
          </Field>
          <Field label="文件类型">
            <select name="docType" defaultValue="notice" className={controlClassName}>
              <option value="regulation">法规</option>
              <option value="announcement">公告</option>
              <option value="notice">通知</option>
              <option value="interpretation">官方解读</option>
              <option value="case">官方案例</option>
              <option value="guide">办税指南</option>
            </select>
          </Field>
          <Field label="生效日期">
            <input
              type="date"
              name="effectiveDate"
              aria-label="生效日期"
              className={controlClassName}
            />
          </Field>
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-[color:var(--cs-divider)] pt-4 md:flex-row md:items-center md:justify-between">
          <label className="flex items-center gap-2 text-sm text-[color:var(--cs-ink)]">
            <input
              type="checkbox"
              name="seedVerified"
              value="true"
              defaultChecked
              className="h-4 w-4 rounded border-[color:var(--cs-border)] accent-[color:var(--cs-primary)]"
            />
            <span>
              可信来源自动核验
              <span className="ml-2 text-xs text-[color:var(--cs-muted)]">
                通过结构检查后自动标记为已核验并触发向量化
              </span>
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={busy !== null}
              onClick={onPreview}
            >
              {busy === "preview" ? "预览中…" : "预览分块"}
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={busy !== null}
            >
              {busy === "upload" ? "上传中…" : "上传并清洗"}
            </Button>
          </div>
        </div>
      </form>

      <aside className="space-y-4">
        <section className="rounded-xl border border-[color:var(--cs-border)] bg-white p-4 shadow-[var(--cs-shadow-sm)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[color:var(--cs-ink)]">
                清洗预览
              </h2>
              <p className="mt-1 text-sm leading-6 text-[color:var(--cs-muted)]">
                预览不会入库，可用于检查条款边界、文号和生效日期。
              </p>
            </div>
            {previewId && (
              <span className="rounded-full bg-[color:var(--cs-success-bg)] px-2.5 py-1 text-xs font-medium text-[#1f8a5b]">
                ready
              </span>
            )}
          </div>
          <div className="mt-4">
            {previewId ? (
              <div className="space-y-3">
                <p className="text-xs text-[color:var(--cs-muted)]">
                  Preview ID: {previewId}
                </p>
                <ChunkPreview chunks={previewChunks} />
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-[color:var(--cs-border)] bg-[#f7fbfe] p-4 text-sm leading-6 text-[color:var(--cs-muted)]">
                选择文件并点击预览分块后，这里会显示即将入库的 Chunk。
              </div>
            )}
          </div>
        </section>

        {(error || taskId) && (
          <section className="space-y-3 rounded-xl border border-[color:var(--cs-border)] bg-white p-4 shadow-[var(--cs-shadow-sm)]">
            <h2 className="text-base font-semibold text-[color:var(--cs-ink)]">
              清洗任务
            </h2>
            {error && (
              <div className="space-y-1 rounded-lg border border-[#f2c3c5] bg-[color:var(--cs-danger-bg)] p-3 text-sm text-[color:var(--cs-danger)]">
                <p>{error}</p>
                {failedDocumentId && (
                  <Link
                    href={`/docs/${failedDocumentId}`}
                    className="inline-block font-medium text-[color:var(--cs-primary)] underline"
                  >
                    查看失败文档
                  </Link>
                )}
              </div>
            )}
            {taskId && <PipelineStatus taskId={taskId} />}
          </section>
        )}
      </aside>
    </div>
  );
}
