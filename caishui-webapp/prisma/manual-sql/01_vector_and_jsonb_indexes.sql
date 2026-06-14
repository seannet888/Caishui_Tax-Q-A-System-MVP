-- 手动索引迁移：在 `prisma migrate dev` 生成基础迁移后，将以下 SQL
-- 追加到对应的 migration.sql 末尾（或单独作为一个空迁移的内容）。
-- Prisma 无法为 Unsupported("vector") 字段自动创建索引，必须手写。

-- 1. pgvector HNSW 索引（余弦相似度，适合语义检索）
CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_hnsw_idx
  ON knowledge_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 2. JSONB GIN 索引（加速 metadata 字段查询）
CREATE INDEX IF NOT EXISTS knowledge_chunks_metadata_gin_idx
  ON knowledge_chunks
  USING GIN (metadata);

-- 3. expire_date 部分索引（时效硬过滤每次检索都会用到）
CREATE INDEX IF NOT EXISTS knowledge_chunks_expire_date_idx
  ON knowledge_chunks (expire_date)
  WHERE expire_date IS NOT NULL;
