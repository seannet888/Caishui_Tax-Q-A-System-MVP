# Embeddings via SiliconFlow bge-large-zh-v1.5 (1024-dim); chat stays DeepSeek

DeepSeek does not offer an embeddings API — `deepseek-embedding` does not exist. Embeddings are therefore served by **硅基流动 (SiliconFlow)** hosting **`BAAI/bge-large-zh-v1.5`**, which is **1024-dimensional**. Chat/generation stays on **DeepSeek** (`deepseek-chat`). The system uses **two providers and two API keys**; both speak the OpenAI-compatible protocol, so only `base_url` + key + model differ.

The vector dimension is a hard schema/index constraint: **1024**, locked. Switching embedding models at runtime is forbidden; a different model means a new column dimension and full re-vectorization (offline).

## Why

- The earlier plan (`deepseek-embedding`, 1536-dim, "reuse the DeepSeek key") rested on a model that isn't available — it would 404 and block the end-to-end prototype.
- `bge-large-zh-v1.5` is a strong Chinese embedding model, hosted (no local GPU), OpenAI-compatible via SiliconFlow. Its native dimension is 1024, so the schema matches the model rather than the reverse.

## Consequences

- `vector(1024)` in `prisma/schema.prisma`; all length guards (`updateChunkEmbedding`, `embedQuery`, `Embedder`) check 1024.
- Embedding config is its own provider block (`EMBEDDING_BASE_URL`, `EMBEDDING_API_KEY`/`SILICONFLOW_API_KEY`, `EMBEDDING_MODEL`, `EMBEDDING_DIMENSION`), separate from `DEEPSEEK_API_KEY`.
- The embedding idempotency key already includes model + dimension, so a future provider/model change naturally invalidates old vectors.
- The architecture doc (v2.1) and PRD must continue to describe SiliconFlow `BAAI/bge-large-zh-v1.5` and 1024 dimensions; any 1536/deepseek-embedding prose is stale and must be removed.
