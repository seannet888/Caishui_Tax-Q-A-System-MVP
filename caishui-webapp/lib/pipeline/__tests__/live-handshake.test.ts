import { describe, expect, it } from "vitest";
import {
  buildLiveIngestInput,
  buildLivePreviewInput,
  isLiveHandshakeEnabled,
  isLiveIngestEnabled,
  withLiveIngestSourceDocument,
} from "./live-handshake-fixture";

const shouldRunLiveHandshake = isLiveHandshakeEnabled();
const describeLiveHandshake = shouldRunLiveHandshake ? describe : describe.skip;
const itLiveIngest = isLiveIngestEnabled() ? it : it.skip;

describeLiveHandshake("WebApp ↔ Pipeline live handshake", () => {
  it("calls pipeline preview with WebApp HMAC client and validates PipelineOutput", async () => {
    const { startPipelinePreview } = await import("@/lib/pipeline/preview-client");

    const output = await startPipelinePreview(buildLivePreviewInput());

    expect(output.status).toBe("success");
    expect(output.document_id).toBe("preview");
    expect(output.total_chunks).toBeGreaterThan(0);
    expect(output.chunks[0]).toMatchObject({
      document_id: "preview",
    });
  });

  itLiveIngest("calls pipeline ingest with WebApp HMAC client and receives an accepted task", async () => {
    const { checkAcceptedTaskReadiness } = await import(
      "@/lib/pipeline/accepted-task-readiness"
    );
    const { startPipelineIngest } = await import("@/lib/pipeline/ingest-client");
    const { prisma } = await import("@/lib/db/client");
    const input = buildLiveIngestInput();

    await withLiveIngestSourceDocument(prisma, input, async (ingestInput) => {
      const accepted = await startPipelineIngest(ingestInput);

      expect(accepted).toMatchObject({
        status: expect.any(String),
        task_id: expect.any(String),
        document_id: ingestInput.payload.documentId,
      });

      await expect(
        checkAcceptedTaskReadiness({
          actor: ingestInput.actor,
          accepted,
        }),
      ).resolves.toMatchObject({
        ready: true,
        taskId: accepted.task_id,
        documentId: ingestInput.payload.documentId,
      });
    });
  });
});
