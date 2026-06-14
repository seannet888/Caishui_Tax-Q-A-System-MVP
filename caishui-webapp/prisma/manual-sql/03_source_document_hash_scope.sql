-- ADR-0001: identical bytes from different Source Channels are distinct Source Documents.
-- Fold this SQL into the next generated Prisma migration before deployment.

DROP INDEX IF EXISTS "source_documents_file_hash_key";

CREATE INDEX IF NOT EXISTS "source_documents_file_hash_source_channel_idx"
  ON source_documents (file_hash, source_channel);
