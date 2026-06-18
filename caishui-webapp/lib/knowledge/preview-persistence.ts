import {
  randomUUID,
} from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { Actor } from "@/lib/auth/actor";
import type { PipelineOutput } from "@/types/pipeline";

export interface PreviewSnapshot {
  previewId: string;
  actorId: string;
  fileName: string;
  sourceChannel: string;
  output: PipelineOutput;
  createdAt: string;
}

export interface PreviewSnapshotStore {
  save(snapshot: PreviewSnapshot): void;
  load(previewId: string): PreviewSnapshot | null;
  delete(previewId: string): void;
  clear(): void;
}

export interface PreviewPersistence {
  save(input: {
    actor: Actor;
    fileName: string;
    sourceChannel: string;
    output: PipelineOutput;
  }): { previewId: string };
  load(previewId: string): PreviewSnapshot | null;
  clear(): void;
}

const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24;

const defaultPersistence = createPreviewPersistence({
  store: createFilePreviewSnapshotStore({
    directory:
      process.env.PREVIEW_SNAPSHOT_DIR ??
      join(process.cwd(), ".preview-snapshots"),
  }),
});

export function createPreviewPersistence({
  store,
  now = () => new Date(),
  id = () => `preview_${randomUUID()}`,
  ttlMs = DEFAULT_TTL_MS,
}: {
  store: PreviewSnapshotStore;
  now?: () => Date;
  id?: () => string;
  ttlMs?: number;
}): PreviewPersistence {
  return {
    save(input) {
      const previewId = id();
      const snapshot: PreviewSnapshot = {
        previewId,
        actorId: input.actor.id,
        fileName: input.fileName,
        sourceChannel: input.sourceChannel,
        output: clone(input.output),
        createdAt: now().toISOString(),
      };
      store.save(snapshot);
      return { previewId };
    },
    load(previewId) {
      const snapshot = store.load(previewId);
      if (!snapshot) return null;
      if (isExpired(snapshot, now(), ttlMs)) {
        store.delete(previewId);
        return null;
      }
      return clone(snapshot);
    },
    clear() {
      store.clear();
    },
  };
}

export function createFilePreviewSnapshotStore({
  directory,
}: {
  directory: string;
}): PreviewSnapshotStore {
  return {
    save(snapshot) {
      ensureDirectory(directory);
      writeFileSync(filePath(directory, snapshot.previewId), stringify(snapshot));
    },
    load(previewId) {
      const path = filePath(directory, previewId);
      if (!existsSync(path)) return null;
      const raw = readFileSync(path, "utf8");
      return JSON.parse(raw) as PreviewSnapshot;
    },
    delete(previewId) {
      rmSync(filePath(directory, previewId), { force: true });
    },
    clear() {
      if (!existsSync(directory)) return;
      for (const file of readdirSync(directory)) {
        if (file.endsWith(".json")) {
          rmSync(join(directory, file), { force: true });
        }
      }
    },
  };
}

export function savePreviewSnapshot(input: {
  actor: Actor;
  fileName: string;
  sourceChannel: string;
  output: PipelineOutput;
}): { previewId: string } {
  return defaultPersistence.save(input);
}

export function loadPreviewSnapshot(previewId: string): PreviewSnapshot | null {
  return defaultPersistence.load(previewId);
}

export function clearPreviewSnapshotsForTest(): void {
  defaultPersistence.clear();
}

function isExpired(
  snapshot: PreviewSnapshot,
  now: Date,
  ttlMs: number,
): boolean {
  const createdAt = Date.parse(snapshot.createdAt);
  if (!Number.isFinite(createdAt)) return true;
  return now.getTime() - createdAt > ttlMs;
}

function filePath(directory: string, previewId: string): string {
  return join(directory, `${safePreviewId(previewId)}.json`);
}

function safePreviewId(previewId: string): string {
  return previewId.replace(/[^a-zA-Z0-9_-]/gu, "_");
}

function ensureDirectory(directory: string): void {
  mkdirSync(directory, { recursive: true });
}

function stringify(snapshot: PreviewSnapshot): string {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
