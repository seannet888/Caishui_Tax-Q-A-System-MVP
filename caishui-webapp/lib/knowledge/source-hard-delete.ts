import { requireRole, type Actor } from "@/lib/auth/actor";
import { prisma } from "@/lib/db/client";

export async function hardDeleteSourceWithAudit(
  documentId: string,
  actor: Actor,
  input: { confirm: boolean; reason: string },
) {
  requireRole(actor, "admin");
  if (!input.confirm) throw new Error("hard_delete_confirmation_required");
  const reason = input.reason.trim();
  if (!reason) throw new Error("hard_delete_reason_required");

  await prisma.$transaction(async (tx) => {
    const previous = await tx.sourceDocument.findUniqueOrThrow({
      where: { id: documentId },
    });
    const chunks = await tx.knowledgeChunk.findMany({
      where: { document_id: documentId },
      select: { id: true },
    });
    const chunkIds = chunks.map((chunk) => chunk.id);
    const historicalCitationCount = chunkIds.length
      ? await tx.answerCitation.count({
          where: { chunk_id: { in: chunkIds } },
        })
      : 0;

    if (historicalCitationCount > 0) {
      throw new Error("source_has_historical_citations");
    }

    await tx.auditEvent.create({
      data: {
        actor_id: actor.id,
        action: "hard_deleted",
        target_type: "SourceDocument",
        target_id: documentId,
        old_state: {
          id: previous.id,
          retrieval_status: previous.retrieval_status,
          file_hash: previous.file_hash,
          source_channel: previous.source_channel,
          chunk_count: chunkIds.length,
        },
        new_state: { deleted: true },
        reason,
      },
    });
    await tx.knowledgeChunk.deleteMany({
      where: { document_id: documentId },
    });
    await tx.sourceDocument.delete({
      where: { id: documentId },
    });
  });
}
