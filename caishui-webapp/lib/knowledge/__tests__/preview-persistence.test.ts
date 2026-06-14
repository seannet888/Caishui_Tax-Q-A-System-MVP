import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PipelineOutput } from "@/types/pipeline";
import {
  clearPreviewSnapshotsForTest,
  createFilePreviewSnapshotStore,
  createPreviewPersistence,
  loadPreviewSnapshot,
  savePreviewSnapshot,
} from "@/lib/knowledge/preview-persistence";

describe("Preview Persistence Module", () => {
  beforeEach(() => {
    clearPreviewSnapshotsForTest();
  });

  afterEach(() => {
    clearPreviewSnapshotsForTest();
  });

  it("保存 pipeline preview output 后可用 previewId 读取稳定快照", () => {
    const output: PipelineOutput = {
      task_id: "preview",
      document_id: "preview",
      status: "success",
      total_chunks: 1,
      processing_time_ms: 12,
      errors: [],
      created_at: "2026-06-12T00:00:00.000Z",
      chunks: [
        {
          chunk_id: "chunk-location-1",
          document_id: "preview",
          chunk_index: 0,
          chunk_type: "text",
          content: "第一条 本公告自2024年1月1日起施行。",
          content_hash:
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          embedding: null,
          embedding_model: null,
          created_at: "2026-06-12T00:00:00.000Z",
          metadata: {
            is_expired: false,
            has_table: false,
            has_formula: false,
            effective_date: "2024-01-01",
            source_channel: "国家税务总局官网",
          },
        },
      ],
    };

    const saved = savePreviewSnapshot({
      actor: { id: "admin-1", roles: ["admin"] },
      fileName: "policy.pdf",
      sourceChannel: "国家税务总局官网",
      output,
    });

    expect(saved.previewId).toMatch(/^preview_/u);
    expect(loadPreviewSnapshot(saved.previewId)).toEqual({
      previewId: saved.previewId,
      actorId: "admin-1",
      fileName: "policy.pdf",
      sourceChannel: "国家税务总局官网",
      output,
      createdAt: expect.any(String),
    });
  });

  it("通过文件 Adapter 持久化 preview snapshot，并隔离调用方后续 mutation", () => {
    const dir = mkdtempSync(join(tmpdir(), "caishui-preview-"));
    try {
      const persistence = createPreviewPersistence({
        store: createFilePreviewSnapshotStore({ directory: dir }),
        now: () => new Date("2026-06-12T00:00:00.000Z"),
        id: () => "preview_file",
      });
      const output = sampleOutput();

      const saved = persistence.save({
        actor: { id: "admin-1", roles: ["admin"] },
        fileName: "policy.pdf",
        sourceChannel: "国家税务总局官网",
        output,
      });
      output.chunks[0]!.content = "调用方后续 mutation 不应污染快照";

      expect(saved).toEqual({ previewId: "preview_file" });
      expect(persistence.load("preview_file")).toMatchObject({
        previewId: "preview_file",
        actorId: "admin-1",
        fileName: "policy.pdf",
        output: {
          chunks: [
            expect.objectContaining({
              content: "第一条 本公告自2024年1月1日起施行。",
            }),
          ],
        },
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("清理超过 TTL 的文件快照", () => {
    const dir = mkdtempSync(join(tmpdir(), "caishui-preview-"));
    try {
      const persistence = createPreviewPersistence({
        store: createFilePreviewSnapshotStore({ directory: dir }),
        now: () => new Date("2026-06-12T00:00:00.000Z"),
        id: () => "preview_expired",
        ttlMs: 60_000,
      });
      persistence.save({
        actor: { id: "admin-1", roles: ["admin"] },
        fileName: "policy.pdf",
        sourceChannel: "国家税务总局官网",
        output: sampleOutput(),
      });

      const later = createPreviewPersistence({
        store: createFilePreviewSnapshotStore({ directory: dir }),
        now: () => new Date("2026-06-12T00:02:00.000Z"),
        id: () => "unused",
        ttlMs: 60_000,
      });

      expect(later.load("preview_expired")).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

function sampleOutput(): PipelineOutput {
  return {
    task_id: "preview",
    document_id: "preview",
    status: "success",
    total_chunks: 1,
    processing_time_ms: 12,
    errors: [],
    created_at: "2026-06-12T00:00:00.000Z",
    chunks: [
      {
        chunk_id: "chunk-location-1",
        document_id: "preview",
        chunk_index: 0,
        chunk_type: "text",
        content: "第一条 本公告自2024年1月1日起施行。",
        content_hash:
          "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        embedding: null,
        embedding_model: null,
        created_at: "2026-06-12T00:00:00.000Z",
        metadata: {
          is_expired: false,
          has_table: false,
          has_formula: false,
          effective_date: "2024-01-01",
          source_channel: "国家税务总局官网",
        },
      },
    ],
  };
}
