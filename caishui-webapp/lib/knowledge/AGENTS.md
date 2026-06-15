# AGENTS.md

Local rules for the knowledge Module: chat turns, retrieval, evidence, answers, citations, source lifecycle, and review read models.

## Owning Modules

- `chat-turn.ts` owns one user turn from Standalone Query through Evidence Policy, Retrieval, deterministic answer persistence, and Answer Generation input preparation. `app/api/chat/route.ts` should remain a thin SSE Adapter.
- `answer-generation.ts` owns streamed model generation events and the `GENERATING -> COMPLETED|FAILED` flow after a turn has enough evidence.
- `answer.ts` owns Answer persistence state transitions only: `startAnswer`, `appendDraft`, `finalizeStreamedAnswer`, `failAnswer`.
- `deterministic-answer.ts` owns no-model answer persistence. Deterministic reasons live in `coverage_evidence_snapshot.deterministicAnswerReason`.
- `retrieval-failure-answer.ts` owns failed Answer persistence for query embedding/retrieval readiness failures.
- `answer-read-model.ts` owns historical Answer + Citation presentation read models and safe failed-answer projection.
- `retriever.ts`, `temporal.ts`, `rerank.ts`, `evidence-policy.ts`, and `coverage-evidence.ts` own retrieval semantics. Do not duplicate these rules in routes.
- `domain-error.ts` owns structured domain error parsing, HTTP status mapping, and administrator-facing lifecycle error labels.
- `admin-action-adapter.ts` owns route-level actor extraction, structured domain error responses, and safe JSON body parsing. API routes should use it instead of duplicating header parsing or string-matching errors.
- `upload-validation.ts` owns shared SourceDocument upload/preview `File` metadata validation: supported extensions, empty-file rejection, size limit, and safe filename checks. Upload and preview route Adapters must call it before reading bytes or calling pipeline/ingestion Modules.
- `source-ingestion.ts` owns Source Document upload preparation and ingest failure compensation.
- `source-withdrawal.ts` owns source withdrawal/restoration, chunk retrieval status changes, CitationAnnotation creation/resolution, and AuditEvent creation.
- `source-hard-delete.ts` owns the exceptional hard-delete path. After all preconditions pass, it must write the `hard_deleted` audit record before deleting dependent rows and the source in the same transaction. This includes Prisma models and Prisma-owned manual SQL tables such as `ingest_tasks`; do not delete `source_documents` while `ingest_tasks.document_id` still references it.
- `chunk-review.ts` owns human verification/rejection and embedding-trigger handoff.
- `document-review-read-model.ts` owns document lifecycle and chunk retrieval-readiness projection for review pages.
- `preview-persistence.ts` owns MVP preview snapshots behind `PreviewSnapshotStore`, `savePreviewSnapshot`, and `loadPreviewSnapshot`. The default store is local file-backed under `PREVIEW_SNAPSHOT_DIR` or `.preview-snapshots/`; keep that directory ignored and do not reintroduce process-only preview state.
- `doc-type-mapping.ts` owns conversion between form input, Prisma `DocType`, and lowercase pipeline wire values.

## Effective Applicability

Default retrieval must require:

- `verification_status = 'verified'`
- `embedding_status = 'COMPLETED'`
- `is_current_version = true`
- `retrieval_status = 'RETRIEVABLE'`
- non-expired for the applicable query date
- embedding present

Do not remove these gates to improve recall.

`pgvector <=>` returns cosine distance, where smaller is closer. Application similarity is `1 - distance`. SQL orders by distance ascending; rerank logic uses similarity descending.

Temporal intent is not year matching. A past year may be a document number or comparison. Use `detectTemporalIntent` and parameterized `Prisma.Sql`, never string-concatenated raw SQL.

## Evidence and Failure Semantics

- `NO_EVIDENCE` means no verified/retrievable evidence was found after a successful search. Return deterministic text and do not call the model.
- Retrieval provider failure is not `NO_EVIDENCE`. If query embedding or retrieval readiness fails, persist a FAILED Answer and emit only the safe user event `retrieval_unavailable`.
- `LIMITED_EVIDENCE` may call the model only with constrained wording.
- `SUFFICIENT_EVIDENCE` may proceed normally, then must pass Citation Grounding before completion.
- Never answer "尚未出台" / "不存在" from non-retrieval alone.

## Answer and Citation State

- Stream tokens write only `draft_text`.
- Draft persistence is batched inside `answer-generation.ts`; SSE tokens may stream per delta, but DB `appendDraft` must not be called for every token. Always flush the latest draft before finalization or failure.
- Final `answer_text` and immutable Citation Snapshots are committed in one transaction only after `checkCitationGrounding` passes.
- `chunkId` in Citation Snapshot is `KnowledgeChunk.id` (CUID), not pipeline `pipeline_chunk_id`.
- Identity meanings:
  - `id` = database relation identity.
  - `pipeline_chunk_id` = stable source position.
  - `content_hash` = content identity.
- Citation Snapshots are immutable historical evidence. Source lifecycle changes create `CitationAnnotation`s instead of rewriting snapshots.
- DeepSeek streaming chat is never auto-retried. Only non-stream embedding requests use retry logic.
- Prompt templates must explicitly require `[n]` citation markers for factual conclusions. When editing TypeScript template literals, do not wrap citation examples with raw backticks such as `` `[1]` `` or `` `[n]` `` inside the template body; use ordinary text or Chinese quotes like `「[1]」` to avoid accidental tagged-template/runtime parsing bugs.
- The default `PROMPT_TEMPLATE_VERSION` is `v1.1` for citation-marker prompt hardening. When prompt behavior materially changes, update this default and add/adjust a prompt-template test in the same change.

## Source Lifecycle

- Default admin removal is withdrawal: set SourceDocument/chunks to `WITHDRAWN`, preserve data for audit.
- Restoration must go through `restoreSourceWithAudit`, restore only that source's chunks, resolve open `source_withdrawn` annotations, and write `AuditEvent(action="source_restored")`.
- Withdrawal/restoration must first identify the chunk ids in the relevant current state (`RETRIEVABLE` for withdrawal, `WITHDRAWN` for restoration), then update and annotate that same target set. Do not run lifecycle `updateMany` over every chunk for the document.
- Hard delete is exceptional: admin role, explicit confirmation, reason, historical citation precondition, and audit.
- Do not transfer chunks across Source Documents during withdrawal, even if content hashes match.

## Verification and Readiness

- Trusted official-source uploads may use the explicit seed verification path (`seedVerified=true`) to mark structurally valid chunks as `verified` during ingestion and trigger embedding. This is the default admin upload UX.
- Per-chunk human review is an exception/spot-check workflow, not a required step for every trusted official import.
- Human verification may succeed while embedding trigger fails. Persist verification and surface embedding trigger failure as a warning.
- Verified chunks are retrieval-ready only when embedding is `COMPLETED` and retrieval status is `RETRIEVABLE`.
- `canRetryEmbedding` is true only for verified/retrievable chunks whose embedding is not completed.
- Withdrawn chunks must not show retry embedding actions.

## Tests

High-value tests: `citation`, `temporal`, `evidence-policy`, `retriever`, `retrieval-failure-answer`, `answer-generation`, `answer-finalization`, `domain-error`, `admin-action-adapter`, `preview-persistence`, `source-withdrawal`, `source-hard-delete`, `chunk-review`, `document-review-read-model`.

Source lifecycle DB smoke is opt-in only: `RUN_DB_SMOKE=true` plus `DATABASE_URL`.
