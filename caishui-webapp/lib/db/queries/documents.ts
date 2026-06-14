// lib/db/queries/documents.ts
// SourceDocument 查询函数（见 ADR-0001）。只做数据读写，不含业务逻辑。

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";

export async function listDocuments(params: {
  skip?: number;
  take?: number;
  where?: Prisma.SourceDocumentWhereInput;
}) {
  const { skip = 0, take = 20, where } = params;
  const [items, total] = await Promise.all([
    prisma.sourceDocument.findMany({
      where,
      skip,
      take,
      orderBy: { created_at: "desc" },
    }),
    prisma.sourceDocument.count({ where }),
  ]);
  return { items, total };
}

export async function getDocument(
  docId: string,
  chunkOptions?: { skip?: number; take?: number },
) {
  const { skip = 0, take = 50 } = chunkOptions ?? {};
  return prisma.sourceDocument.findUnique({
    where: { id: docId },
    include: {
      chunks: {
        orderBy: { chunk_index: "asc" },
        skip,
        take,
        // 注意：embedding 字段在此返回恒为 null（Unsupported 类型设计限制）
      },
      _count: { select: { chunks: true } },
    },
  });
}
