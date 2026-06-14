-- ingest_tasks 表：data-pipeline 独占读写，但 DDL 统一由 Prisma migration 管理。
-- Next.js 业务代码不通过 Prisma Client 访问该表。
-- 在 `prisma migrate dev` 生成基础迁移后追加此 SQL。

CREATE TABLE IF NOT EXISTS ingest_tasks (
  task_id           TEXT PRIMARY KEY,
  document_id       TEXT NOT NULL REFERENCES source_documents(id) ON DELETE RESTRICT,
  status            TEXT NOT NULL CHECK (
    status IN ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED')
  ),
  completed_chunks  INTEGER NOT NULL DEFAULT 0 CHECK (completed_chunks >= 0),
  total_chunks      INTEGER NOT NULL DEFAULT 0 CHECK (total_chunks >= 0),
  error_message     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ingest_tasks_document_id_idx ON ingest_tasks(document_id);
CREATE INDEX IF NOT EXISTS ingest_tasks_status_idx ON ingest_tasks(status);
CREATE INDEX IF NOT EXISTS ingest_tasks_updated_at_idx ON ingest_tasks(updated_at);
