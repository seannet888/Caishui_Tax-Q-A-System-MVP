import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Prisma migration contract", () => {
  it("initial migration folds vector, lifecycle, and pipeline-owned DDL", () => {
    const migration = readFileSync(
      join(
        process.cwd(),
        "prisma",
        "migrations",
        "20260612141000_init",
        "migration.sql",
      ),
      "utf8",
    );

    expect(migration).toContain('CREATE EXTENSION IF NOT EXISTS "vector"');
    expect(migration).toContain("vector(1024)");
    expect(migration).toContain("USING hnsw (embedding vector_cosine_ops)");
    expect(migration).toContain("knowledge_chunks_metadata_gin_idx");
    expect(migration).toContain("knowledge_chunks_expire_date_idx");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS ingest_tasks");
    expect(migration).toContain("knowledge_chunks_one_current_version_idx");
  });
});
