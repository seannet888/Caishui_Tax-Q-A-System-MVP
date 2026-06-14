// Chunk Review Module：人工核验/拒绝单个 Knowledge Chunk。
// MVP 中 auto verification 禁用；可检索内容必须通过 seed 或 human 路径进入 verified。

import { RetrievalStatus } from "@prisma/client";
import { requireRole, type Actor } from "@/lib/auth/actor";
import { prisma } from "@/lib/db/client";

const CHUNK_REVIEW_SELECT = {
  id: true,
  verification_status: true,
  verification_method: true,
  verification_notes: true,
  retrieval_status: true,
} as const;

export async function verifyChunkHuman(
  chunkId: string,
  actor: Actor,
  notes: string,
) {
  requireRole(actor, "reviewer");
  const reason = notes.trim();
  if (!reason) throw new Error("verification_notes_required");

  await prisma.$transaction(async (tx) => {
    const previous = await readReviewableUnverifiedChunk(tx, chunkId);

    await tx.knowledgeChunk.update({
      where: { id: chunkId },
      data: {
        verification_status: "verified",
        verification_method: "human",
        verified_by: actor.id,
        verified_at: new Date(),
        verification_notes: reason,
      },
    });

    await tx.auditEvent.create({
      data: {
        actor_id: actor.id,
        action: "human_verified",
        target_type: "KnowledgeChunk",
        target_id: chunkId,
        old_state: previous,
        new_state: {
          verification_status: "verified",
          verification_method: "human",
        },
        reason,
      },
    });
  });
}

export async function rejectChunk(
  chunkId: string,
  actor: Actor,
  reasonInput: string,
) {
  requireRole(actor, "reviewer");
  const reason = reasonInput.trim();
  if (!reason) throw new Error("rejection_reason_required");

  await prisma.$transaction(async (tx) => {
    const previous = await readReviewableUnverifiedChunk(tx, chunkId);

    await tx.knowledgeChunk.update({
      where: { id: chunkId },
      data: {
        verification_status: "rejected",
        verification_method: null,
        verified_by: null,
        verified_at: null,
        verification_notes: reason,
      },
    });

    await tx.auditEvent.create({
      data: {
        actor_id: actor.id,
        action: "chunk_rejected",
        target_type: "KnowledgeChunk",
        target_id: chunkId,
        old_state: previous,
        new_state: {
          verification_status: "rejected",
          verification_method: null,
        },
        reason,
      },
    });
  });
}

async function readReviewableUnverifiedChunk(
  tx: {
    knowledgeChunk: {
      findUniqueOrThrow: (args: {
        where: { id: string };
        select: typeof CHUNK_REVIEW_SELECT;
      }) => Promise<{
        id: string;
        verification_status: string;
        verification_method: string | null;
        verification_notes: string | null;
        retrieval_status: string;
      }>;
    };
  },
  chunkId: string,
) {
  const previous = await tx.knowledgeChunk.findUniqueOrThrow({
    where: { id: chunkId },
    select: CHUNK_REVIEW_SELECT,
  });

  if (previous.retrieval_status !== RetrievalStatus.RETRIEVABLE) {
    throw new Error("chunk_not_retrievable");
  }
  if (previous.verification_status !== "unverified") {
    throw new Error("chunk_must_be_unverified");
  }
  return previous;
}
