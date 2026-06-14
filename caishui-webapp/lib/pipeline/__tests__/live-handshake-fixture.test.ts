import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  buildLiveIngestInput,
  buildLivePreviewInput,
  isLiveHandshakeEnabled,
  isLiveIngestEnabled,
  LIVE_HANDSHAKE_ACTOR,
  withLiveIngestSourceDocument,
} from "./live-handshake-fixture";

describe("live handshake fixture", () => {
  it("builds preview input with pipeline wire doc type values", () => {
    const input = buildLivePreviewInput();

    expect(input).toMatchObject({
      actor: LIVE_HANDSHAKE_ACTOR,
      fileName: "live-preview.md",
      title: "Live Preview Handshake",
      sourceChannel: "live-handshake",
      issuingBody: "国家税务总局",
      jurisdiction: "全国",
      docType: "notice",
    });
    expect(input.bytes.byteLength).toBeGreaterThan(20);
  });

  it("builds ingest input with a hash derived from the uploaded bytes", () => {
    const input = buildLiveIngestInput("fixture-doc-id");
    const expectedHash = createHash("sha256")
      .update(input.payload.bytes)
      .digest("hex");

    expect(input.actor).toBe(LIVE_HANDSHAKE_ACTOR);
    expect(input.payload).toMatchObject({
      documentId: "fixture-doc-id",
      fileName: "live-ingest.md",
      title: "Live Ingest Handshake",
      sourceChannel: "live-handshake",
      issuingBody: "国家税务总局",
      jurisdiction: "全国",
      docType: "notice",
      fileHash: expectedHash,
    });
  });

  it("enables live preview only when pipeline URL and shared secret are configured", () => {
    expect(
      isLiveHandshakeEnabled({
        RUN_PIPELINE_LIVE: "true",
        DATA_PIPELINE_URL: "http://127.0.0.1:8000",
        PIPELINE_SHARED_SECRET: "local-smoke-secret",
      }),
    ).toBe(true);
    expect(
      isLiveHandshakeEnabled({
        RUN_PIPELINE_LIVE: "true",
        DATA_PIPELINE_URL: "http://127.0.0.1:8000",
      }),
    ).toBe(false);
  });

  it("enables live ingest only when DATABASE_URL is configured too", () => {
    expect(
      isLiveIngestEnabled({
        RUN_PIPELINE_LIVE: "true",
        DATA_PIPELINE_URL: "http://127.0.0.1:8000",
        PIPELINE_SHARED_SECRET: "local-smoke-secret",
      }),
    ).toBe(false);
    expect(
      isLiveIngestEnabled({
        RUN_PIPELINE_LIVE: "true",
        DATA_PIPELINE_URL: "http://127.0.0.1:8000",
        PIPELINE_SHARED_SECRET: "local-smoke-secret",
        DATABASE_URL:
          "postgresql://caishui:localdev_password@127.0.0.1:55432/caishui_db",
      }),
    ).toBe(true);
  });

  it("creates the WebApp-owned SourceDocument and cleans live ingest rows afterwards", async () => {
    const input = buildLiveIngestInput("fixture-cleanup-doc-id");
    const calls: string[] = [];
    const prisma = {
      sourceDocument: {
        create: async () => {
          calls.push("source.create");
        },
        deleteMany: async () => {
          calls.push("source.deleteMany");
        },
      },
      knowledgeChunk: {
        deleteMany: async () => {
          calls.push("chunks.deleteMany");
        },
      },
      $executeRaw: async () => {
        calls.push("ingest_tasks.delete");
      },
    };

    const result = await withLiveIngestSourceDocument(
      prisma as never,
      input,
      async () => {
        calls.push("run");
        return "accepted";
      },
    );

    expect(result).toBe("accepted");
    expect(calls).toEqual([
      "source.create",
      "run",
      "ingest_tasks.delete",
      "chunks.deleteMany",
      "source.deleteMany",
    ]);
  });

  it("still cleans live ingest rows when the handshake fails", async () => {
    const input = buildLiveIngestInput("fixture-failure-doc-id");
    const calls: string[] = [];
    const prisma = {
      sourceDocument: {
        create: async () => {
          calls.push("source.create");
        },
        deleteMany: async () => {
          calls.push("source.deleteMany");
        },
      },
      knowledgeChunk: {
        deleteMany: async () => {
          calls.push("chunks.deleteMany");
        },
      },
      $executeRaw: async () => {
        calls.push("ingest_tasks.delete");
      },
    };

    await expect(
      withLiveIngestSourceDocument(prisma as never, input, async () => {
        calls.push("run");
        throw new Error("pipeline_rejected");
      }),
    ).rejects.toThrow("pipeline_rejected");

    expect(calls).toEqual([
      "source.create",
      "run",
      "ingest_tasks.delete",
      "chunks.deleteMany",
      "source.deleteMany",
    ]);
  });
});
