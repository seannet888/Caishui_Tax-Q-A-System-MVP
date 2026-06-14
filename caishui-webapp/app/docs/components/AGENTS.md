# AGENTS.md

Local rules for document and chunk review UI Modules.

## Owning Modules

- `DocumentLifecycleActions.tsx` owns admin document lifecycle UI wiring for withdraw, restore, and restricted hard delete.
- `document-lifecycle-client.ts` owns browser-side POST/DELETE calls and maps structured backend/domain error codes into administrator-facing messages.
- `document-review-presenter.ts` owns document-detail presentation projection for lifecycle and chunk readiness.
- `chunk-review-response-presenter.ts` owns chunk review response projection.
- `ChunkEmbeddingRetryAction.tsx` owns manual retry UI for verified chunk embedding trigger.

## UI Projection Rules

- Document detail pages must consume `document-review-presenter.ts` output for titles, tones, action hints, lifecycle labels, and readiness labels.
- Document detail pages must load chunks through the paginated `loadDocumentReview(..., { chunkPage, chunkPageSize })` Interface. Do not fetch every chunk for large documents.
- Do not re-derive document lifecycle or chunk readiness rules directly in JSX.
- Human verification may succeed while embedding trigger fails; show it as a warning, not as a rollback.
- Verified chunks are ready only when embedding is `COMPLETED` and retrieval status is `RETRIEVABLE`.
- Withdrawn chunks must not show retry embedding actions.

## Lifecycle Actions

- Withdraw/restore are normal admin actions.
- Hard delete is exceptional, must require explicit confirmation and reason, and must surface blocked preconditions clearly.
- Permission failures from lifecycle routes should appear as forbidden/role failures, not generic validation errors.
- Lifecycle UI must consume structured `{ error, detail?, documentId? }` responses. Do not parse raw thrown strings or expose backend stack/provider details.
