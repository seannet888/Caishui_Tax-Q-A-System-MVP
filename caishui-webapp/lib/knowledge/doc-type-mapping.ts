import { DocType as PrismaDocType } from "@prisma/client";
import type { DocType as PipelineDocType } from "@/types/pipeline";

const PIPELINE_TO_PRISMA: Record<PipelineDocType, PrismaDocType> = {
  regulation: PrismaDocType.REGULATION,
  announcement: PrismaDocType.ANNOUNCEMENT,
  notice: PrismaDocType.NOTICE,
  interpretation: PrismaDocType.INTERPRETATION,
  case: PrismaDocType.CASE,
  guide: PrismaDocType.GUIDE,
};

const PRISMA_TO_PIPELINE: Record<PrismaDocType, PipelineDocType> = {
  [PrismaDocType.REGULATION]: "regulation",
  [PrismaDocType.ANNOUNCEMENT]: "announcement",
  [PrismaDocType.NOTICE]: "notice",
  [PrismaDocType.INTERPRETATION]: "interpretation",
  [PrismaDocType.CASE]: "case",
  [PrismaDocType.GUIDE]: "guide",
};

export interface NormalizedDocType {
  prisma: PrismaDocType;
  pipeline: PipelineDocType;
}

export function normalizeDocType(input: string | undefined): NormalizedDocType {
  const pipeline = normalizePipelineDocType(input);
  return {
    prisma: toPrismaDocType(pipeline),
    pipeline,
  };
}

export function toPrismaDocType(input: PipelineDocType): PrismaDocType {
  return PIPELINE_TO_PRISMA[input];
}

export function toPipelineDocType(input: PrismaDocType): PipelineDocType {
  return PRISMA_TO_PIPELINE[input];
}

function normalizePipelineDocType(input: string | undefined): PipelineDocType {
  const value = input?.trim().toLowerCase();
  if (isPipelineDocType(value)) return value;
  return "notice";
}

function isPipelineDocType(value: string | undefined): value is PipelineDocType {
  return (
    value === "regulation" ||
    value === "announcement" ||
    value === "notice" ||
    value === "interpretation" ||
    value === "case" ||
    value === "guide"
  );
}
