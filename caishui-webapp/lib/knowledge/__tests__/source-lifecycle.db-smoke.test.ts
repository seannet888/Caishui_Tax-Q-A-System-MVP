import { describe, expect, it } from "vitest";

const shouldRunDbSmoke =
  process.env.RUN_DB_SMOKE === "true" && Boolean(process.env.DATABASE_URL);
const describeDbSmoke = shouldRunDbSmoke ? describe : describe.skip;

describeDbSmoke("Source Document lifecycle DB smoke", () => {
  it("withdraws a cited source, annotates historical citations, and blocks hard delete", async () => {
    const { prisma } = await import("@/lib/db/client");
    const { withdrawSourceWithAudit } = await import(
      "@/lib/knowledge/source-withdrawal"
    );
    const { hardDeleteSourceWithAudit } = await import(
      "@/lib/knowledge/source-hard-delete"
    );

    const suffix = `smoke-${Date.now()}`;
    const actor = { id: "db-smoke-admin", roles: ["admin" as const] };
    const doc = await prisma.sourceDocument.create({
      data: {
        title: `DB Smoke ${suffix}`,
        file_name: `${suffix}.md`,
        file_type: "MD",
        file_size: 128,
        file_hash: suffix,
        source_channel: "db-smoke",
      },
    });
    const chunk = await prisma.knowledgeChunk.create({
      data: {
        pipeline_chunk_id: `${suffix}-chunk-0`,
        document_id: doc.id,
        content: "第一条 本测试 chunk 用于验证撤出、引用注解与硬删除前置条件。",
        content_hash: `${suffix}-content`,
        chunk_index: 0,
        verification_status: "verified",
        verification_method: "seed",
        embedding_status: "COMPLETED",
      },
    });
    const answer = await prisma.answer.create({
      data: {
        conversation_id: `${suffix}-conversation`,
        original_question: "测试问题",
        retrieval_query: "测试问题",
        status: "COMPLETED",
        answer_text: "测试回答 [1]",
        model: "db-smoke",
        prompt_template_version: "db-smoke",
        coverage_evidence_snapshot: {},
        completed_at: new Date(),
      },
    });
    const citation = await prisma.answerCitation.create({
      data: {
        answer_id: answer.id,
        chunk_id: chunk.id,
        snapshot: {
          docNumber: null,
          evidenceExcerpt: chunk.content,
          contentHash: chunk.content_hash,
        },
      },
    });

    try {
      await withdrawSourceWithAudit(doc.id, actor, "DB smoke 撤出测试");

      await expect(
        hardDeleteSourceWithAudit(doc.id, actor, {
          confirm: true,
          reason: "DB smoke 硬删除测试",
        }),
      ).rejects.toThrow("source_has_historical_citations");

      await expect(
        prisma.sourceDocument.findUniqueOrThrow({ where: { id: doc.id } }),
      ).resolves.toMatchObject({ retrieval_status: "WITHDRAWN" });
      await expect(
        prisma.knowledgeChunk.findUniqueOrThrow({ where: { id: chunk.id } }),
      ).resolves.toMatchObject({ retrieval_status: "WITHDRAWN" });
      await expect(
        prisma.citationAnnotation.findFirstOrThrow({
          where: {
            answer_citation_id: citation.id,
            annotation_type: "source_withdrawn",
          },
        }),
      ).resolves.toMatchObject({
        message: expect.stringContaining("DB smoke 撤出测试"),
      });
      await expect(
        prisma.auditEvent.findFirstOrThrow({
          where: {
            target_id: doc.id,
            action: "source_withdrawn",
          },
        }),
      ).resolves.toMatchObject({
        actor_id: actor.id,
        reason: "DB smoke 撤出测试",
      });
    } finally {
      await prisma.citationAnnotation.deleteMany({
        where: { answer_citation_id: citation.id },
      });
      await prisma.answerCitation.deleteMany({ where: { answer_id: answer.id } });
      await prisma.answer.deleteMany({ where: { id: answer.id } });
      await prisma.knowledgeChunk.deleteMany({ where: { document_id: doc.id } });
      await prisma.auditEvent.deleteMany({ where: { target_id: doc.id } });
      await prisma.sourceDocument.deleteMany({ where: { id: doc.id } });
    }
  });

  it("hard deletes an uncited source and keeps a hard_deleted audit event", async () => {
    const { prisma } = await import("@/lib/db/client");
    const { hardDeleteSourceWithAudit } = await import(
      "@/lib/knowledge/source-hard-delete"
    );

    const suffix = `smoke-hard-delete-${Date.now()}`;
    const actor = { id: "db-smoke-admin", roles: ["admin" as const] };
    const doc = await prisma.sourceDocument.create({
      data: {
        title: `DB Smoke ${suffix}`,
        file_name: `${suffix}.md`,
        file_type: "MD",
        file_size: 128,
        file_hash: suffix,
        source_channel: "db-smoke",
      },
    });
    await prisma.knowledgeChunk.create({
      data: {
        pipeline_chunk_id: `${suffix}-chunk-0`,
        document_id: doc.id,
        content: "第一条 本测试 chunk 用于验证无引用来源可以受限硬删除。",
        content_hash: `${suffix}-content`,
        chunk_index: 0,
        verification_status: "verified",
        verification_method: "seed",
        embedding_status: "COMPLETED",
      },
    });

    try {
      await hardDeleteSourceWithAudit(doc.id, actor, {
        confirm: true,
        reason: "DB smoke 硬删除测试",
      });

      await expect(
        prisma.sourceDocument.findUnique({ where: { id: doc.id } }),
      ).resolves.toBeNull();
      await expect(
        prisma.knowledgeChunk.count({ where: { document_id: doc.id } }),
      ).resolves.toBe(0);
      await expect(
        prisma.auditEvent.findFirstOrThrow({
          where: { target_id: doc.id, action: "hard_deleted" },
        }),
      ).resolves.toMatchObject({
        actor_id: actor.id,
        reason: "DB smoke 硬删除测试",
      });
    } finally {
      await prisma.knowledgeChunk.deleteMany({ where: { document_id: doc.id } });
      await prisma.auditEvent.deleteMany({ where: { target_id: doc.id } });
      await prisma.sourceDocument.deleteMany({ where: { id: doc.id } });
    }
  });
});
