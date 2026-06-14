import {
  runE2ESmokeHarness,
  type E2ESmokeHarnessInput,
  type E2ESmokeHarnessResult,
} from "@/lib/smoke/e2e-smoke-harness";
import { createE2ESmokeSteps } from "@/lib/smoke/e2e-smoke-adapters";
import { retrieveVerifiedSmokeChunks } from "@/lib/smoke/deterministic-smoke-retrieval";
import { prisma } from "@/lib/db/client";
import { getErrorMessage } from "@/lib/utils/error";

type LiveSmokeEnv = Record<string, string | undefined>;

type LiveSmokeEnabled =
  | { enabled: true }
  | { enabled: false; reason: string };

interface LiveSmokeRunnerDependencies {
  runHarness?: typeof runE2ESmokeHarness;
  createSteps?: typeof createE2ESmokeSteps;
  cleanup?: (sourceDocumentId: string) => Promise<void>;
  verifyCleanup?: (sourceDocumentId: string) => Promise<LiveE2ESmokeResidualRows>;
}

export interface LiveE2ESmokeResidualRows {
  sourceDocuments: number;
  knowledgeChunks: number;
  ingestTasks: number;
}

export type LiveE2ESmokeCleanupResult =
  | { ok: true; sourceDocumentId: string }
  | {
      ok: false;
      sourceDocumentId: string;
      reason: string;
      residualRows?: LiveE2ESmokeResidualRows;
    };

export type LiveE2ESmokeRunnerResult = E2ESmokeHarnessResult & {
  cleanup?: LiveE2ESmokeCleanupResult;
};

const REQUIRED_LIVE_ENV = [
  "DATABASE_URL",
  "DATA_PIPELINE_URL",
  "PIPELINE_SHARED_SECRET",
] as const;

export function isLiveE2ESmokeEnabled(
  env: LiveSmokeEnv = process.env,
): LiveSmokeEnabled {
  if (env.RUN_E2E_SMOKE !== "true") {
    return { enabled: false, reason: "RUN_E2E_SMOKE_not_true" };
  }
  for (const key of REQUIRED_LIVE_ENV) {
    if (!env[key]) return { enabled: false, reason: `missing_env:${key}` };
  }
  return { enabled: true };
}

export function createLiveE2ESmokeRunner(
  dependencies: LiveSmokeRunnerDependencies = {},
) {
  const runHarness = dependencies.runHarness ?? runE2ESmokeHarness;
  const createSteps = dependencies.createSteps ?? createE2ESmokeSteps;
  const cleanup = dependencies.cleanup ?? cleanupLiveE2ESmokeSource;
  const verifyCleanup =
    dependencies.verifyCleanup ?? verifyLiveE2ESmokeCleanup;

  return {
    async run(): Promise<LiveE2ESmokeRunnerResult> {
      const steps = createSteps({
        answerQuestion: async ({ chunkIds }) => ({
          answerId: "deterministic-smoke-answer",
          citationCount: chunkIds.length,
        }),
      });
      const deterministicSteps: E2ESmokeHarnessInput["steps"] = {
        ...steps,
        async retrieveForQuestion({ verifiedChunkIds }) {
          return retrieveVerifiedSmokeChunks({ verifiedChunkIds });
        },
      };

      const result = await runHarness({
        actor: { id: "e2e-smoke-admin", roles: ["admin", "reviewer"] },
        source: {
          fileName: "e2e-smoke.md",
          bytes: Buffer.from("# 研发费用加计扣除政策\n\n第一条 本文件用于 E2E smoke。"),
          title: "E2E Smoke Source",
          sourceChannel: "e2e-smoke",
        },
        question: "研发费用加计扣除政策是什么？",
        steps: deterministicSteps,
      } satisfies E2ESmokeHarnessInput);
      if (!result.sourceDocumentId) return result;
      const cleanupResult = await cleanupLiveE2ESmokeResult(
        result.sourceDocumentId,
        cleanup,
        verifyCleanup,
      );
      return { ...result, cleanup: cleanupResult };
    },
  };
}

export async function cleanupLiveE2ESmokeResult(
  sourceDocumentId: string,
  cleanup: (sourceDocumentId: string) => Promise<void>,
  verifyCleanup: (sourceDocumentId: string) => Promise<LiveE2ESmokeResidualRows>,
): Promise<LiveE2ESmokeCleanupResult> {
  try {
    await cleanup(sourceDocumentId);
    const residualRows = await verifyCleanup(sourceDocumentId);
    if (hasResidualRows(residualRows)) {
      return {
        ok: false,
        sourceDocumentId,
        reason: "cleanup_residual_rows",
        residualRows,
      };
    }
    return { ok: true, sourceDocumentId };
  } catch (error) {
    return {
      ok: false,
      sourceDocumentId,
      reason: getErrorMessage(error),
    };
  }
}

export async function verifyLiveE2ESmokeCleanup(
  sourceDocumentId: string,
): Promise<LiveE2ESmokeResidualRows> {
  const ingestTasks = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count FROM ingest_tasks WHERE document_id = ${sourceDocumentId}
  `;
  const [sourceDocuments, knowledgeChunks] = await Promise.all([
    prisma.sourceDocument.count({ where: { id: sourceDocumentId } }),
    prisma.knowledgeChunk.count({ where: { document_id: sourceDocumentId } }),
  ]);
  return {
    sourceDocuments,
    knowledgeChunks,
    ingestTasks: Number(ingestTasks[0]?.count ?? 0),
  };
}

function hasResidualRows(rows: LiveE2ESmokeResidualRows): boolean {
  return rows.sourceDocuments > 0 || rows.knowledgeChunks > 0 || rows.ingestTasks > 0;
}

export async function cleanupLiveE2ESmokeSource(sourceDocumentId: string) {
  await prisma.$executeRaw`DELETE FROM ingest_tasks WHERE document_id = ${sourceDocumentId}`;
  await prisma.knowledgeChunk.deleteMany({ where: { document_id: sourceDocumentId } });
  await prisma.sourceDocument.deleteMany({ where: { id: sourceDocumentId } });
}
