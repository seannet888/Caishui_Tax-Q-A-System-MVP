-- Chunk Lifecycle invariant:
-- one Source Document + stable Chunk Location may have at most one current row.
-- The pipeline also serializes transitions with pg_advisory_xact_lock, while
-- this partial unique index is the final database-level protection.

CREATE UNIQUE INDEX IF NOT EXISTS knowledge_chunks_one_current_version_idx
  ON knowledge_chunks (document_id, pipeline_chunk_id)
  WHERE is_current_version = true;
