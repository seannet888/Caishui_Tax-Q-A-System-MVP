// Source Withdrawal Module：撤出 Source Document 的当前检索资格，并为历史 Citation 追加注解。
// Citation Snapshot 是不可变历史事实；撤出来源只能追加 CitationAnnotation，不能改写 snapshot。

import { RetrievalStatus } from "@prisma/client";
import { requireRole, type Actor } from "@/lib/auth/actor";
import { prisma } from "@/lib/db/client";

/** 撤出来源（默认管理动作）+ 审计，单事务提交。 */
export async function withdrawSourceWithAudit(
  documentId: string,
  actor: Actor,
  reason: string,
) {
  requireRole(actor, "admin");
  if (!reason.trim()) throw new Error("withdrawal_reason_required");

  await prisma.$transaction(async (tx) => {
    const withdrawn = RetrievalStatus.WITHDRAWN;
    const previous = await tx.sourceDocument.findUniqueOrThrow({
      where: { id: documentId },
    });

    await tx.sourceDocument.update({
      where: { id: documentId },
      data: { retrieval_status: withdrawn },
    });
    const withdrawnChunks = await tx.knowledgeChunk.findMany({
      where: {
        document_id: documentId,
        retrieval_status: RetrievalStatus.RETRIEVABLE,
      },
      select: { id: true },
    });
    const withdrawnChunkIds = withdrawnChunks.map((chunk) => chunk.id);
    if (withdrawnChunkIds.length) {
      await tx.knowledgeChunk.updateMany({
        where: {
          id: { in: withdrawnChunkIds },
          retrieval_status: RetrievalStatus.RETRIEVABLE,
        },
        data: {
          retrieval_status: withdrawn,
          withdrawn_at: new Date(),
          withdrawn_by: actor.id,
          withdrawal_reason: reason,
        },
      });
    }
    if (withdrawnChunkIds.length) {
      const affectedCitations = await tx.answerCitation.findMany({
        where: {
          chunk_id: { in: withdrawnChunkIds },
          annotations: {
            none: { annotation_type: "source_withdrawn", resolved_at: null },
          },
        },
        select: { id: true },
      });
      if (affectedCitations.length) {
        await tx.citationAnnotation.createMany({
          data: affectedCitations.map((citation) => ({
            answer_citation_id: citation.id,
            annotation_type: "source_withdrawn",
            message: `该引用来源已从当前知识库中撤出：${reason}`,
          })),
        });
      }
    }

    await tx.auditEvent.create({
      data: {
        actor_id: actor.id,
        action: "source_withdrawn",
        target_type: "SourceDocument",
        target_id: documentId,
        old_state: { retrieval_status: previous.retrieval_status },
        new_state: { retrieval_status: withdrawn },
        reason,
      },
    });
  });
}

/** 恢复来源当前检索资格 + 审计，单事务提交。 */
export async function restoreSourceWithAudit(
  documentId: string,
  actor: Actor,
  reason: string,
) {
  requireRole(actor, "admin");
  if (!reason.trim()) throw new Error("restore_reason_required");

  await prisma.$transaction(async (tx) => {
    const restored = RetrievalStatus.RETRIEVABLE;
    const previous = await tx.sourceDocument.findUniqueOrThrow({
      where: { id: documentId },
    });

    await tx.sourceDocument.update({
      where: { id: documentId },
      data: { retrieval_status: restored },
    });
    const restoredChunks = await tx.knowledgeChunk.findMany({
      where: {
        document_id: documentId,
        retrieval_status: RetrievalStatus.WITHDRAWN,
      },
      select: { id: true },
    });
    const restoredChunkIds = restoredChunks.map((chunk) => chunk.id);
    if (restoredChunkIds.length) {
      await tx.knowledgeChunk.updateMany({
        where: {
          id: { in: restoredChunkIds },
          retrieval_status: RetrievalStatus.WITHDRAWN,
        },
        data: {
          retrieval_status: restored,
          withdrawn_at: null,
          withdrawn_by: null,
          withdrawal_reason: null,
        },
      });
    }
    if (restoredChunkIds.length) {
      await tx.citationAnnotation.updateMany({
        where: {
          annotation_type: "source_withdrawn",
          resolved_at: null,
          answer_citation: { chunk_id: { in: restoredChunkIds } },
        },
        data: { resolved_at: new Date() },
      });
    }

    await tx.auditEvent.create({
      data: {
        actor_id: actor.id,
        action: "source_restored",
        target_type: "SourceDocument",
        target_id: documentId,
        old_state: { retrieval_status: previous.retrieval_status },
        new_state: { retrieval_status: restored },
        reason,
      },
    });
  });
}
