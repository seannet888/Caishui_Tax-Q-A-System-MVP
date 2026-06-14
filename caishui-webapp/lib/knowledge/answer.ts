// lib/knowledge/answer.ts
// 流式答案持久化 + 状态机 + Citation Grounding Check 提交。
// 状态转换：GENERATING -> COMPLETED | FAILED。
// 流式 token 只写 draft_text；只有通过 grounding check 后才在单事务内写 answer_text + Citation Snapshots。

import { prisma } from "@/lib/db/client";
import type { RetrievedEvidence } from "@/types/knowledge";
import type { RetrievalCoverageEvidence } from "@/lib/knowledge/coverage-evidence";
import { finalizeAnswer } from "@/lib/knowledge/answer-finalization";
import { PROMPT_TEMPLATE_VERSION } from "@/lib/knowledge/prompt-templates";

/** 请求开始时创建 GENERATING Answer，立即固化问题、模型、Prompt 版本和覆盖证据。 */
export async function startAnswer(input: {
  conversationId: string;
  originalQuestion: string;
  retrievalQuery: string | null;
  contextSnapshot: unknown;
  model: string;
  coverageEvidence: RetrievalCoverageEvidence;
}) {
  return prisma.answer.create({
    data: {
      conversation_id: input.conversationId,
      original_question: input.originalQuestion,
      retrieval_query: input.retrievalQuery,
      context_snapshot: input.contextSnapshot as object,
      status: "GENERATING",
      model: input.model,
      prompt_template_version: PROMPT_TEMPLATE_VERSION,
      coverage_evidence_snapshot: input.coverageEvidence as unknown as object,
    },
  });
}

/** 周期性写入流式草稿。不得写 answer_text 或创建最终 Citation Snapshots。 */
export async function appendDraft(answerId: string, draftText: string) {
  await prisma.answer.update({
    where: { id: answerId, status: "GENERATING" },
    data: { draft_text: draftText },
  });
}

/** Answer Finalization 的 Prisma Adapter：拒绝失败草稿，或原子提交正式答案与引用快照。 */
export async function finalizeStreamedAnswer(
  answerId: string,
  answerText: string,
  evidence: RetrievedEvidence[],
): Promise<
  { status: "completed" } | { status: "failed"; errorCode: "grounding_failed" }
> {
  return finalizeAnswer(
    { answerId, answerText, evidence },
    {
      reject: async ({ answerId: rejectedAnswerId, errors }) => {
        await prisma.answer.update({
          where: { id: rejectedAnswerId, status: "GENERATING" },
          data: {
            status: "FAILED",
            failed_at: new Date(),
            error_code: "grounding_failed",
            error_message: errors.join(";"),
          },
        });
      },
      commit: async ({
        answerId: completedAnswerId,
        answerText: completedText,
        citations,
      }) => {
        await prisma.$transaction(async (tx) => {
          await tx.answer.update({
            where: { id: completedAnswerId, status: "GENERATING" },
            data: {
              status: "COMPLETED",
              answer_text: completedText,
              draft_text: null,
              completed_at: new Date(),
            },
          });
          await tx.answerCitation.createMany({
            data: citations.map((snapshot) => ({
              answer_id: completedAnswerId,
              chunk_id: snapshot.chunkId,
              snapshot: snapshot as unknown as object,
            })),
          });
        });
      },
    },
  );
}

/** 模型/SSE/事务失败、客户端断开等。保留 draft_text 供诊断，但 UI 不得显示为正式答案。 */
export async function failAnswer(
  answerId: string,
  input: { errorCode: string; errorMessage: string },
) {
  await prisma.answer.update({
    where: { id: answerId, status: "GENERATING" },
    data: {
      status: "FAILED",
      failed_at: new Date(),
      error_code: input.errorCode,
      error_message: input.errorMessage,
    },
  });
}
