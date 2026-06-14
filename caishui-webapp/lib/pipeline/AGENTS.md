# AGENTS.md

Local rules for WebApp -> data-pipeline communication.

## Owning Modules

- `trust-adapter.ts` owns HMAC request signing.
- `http-client.ts` owns shared transport: `DATA_PIPELINE_URL`, signing, `fetch`, status, and raw response-body parsing.
- `response.ts` owns pipeline HTTP response parsing and error formatting.
- `preview-client.ts` owns `/preview` FormData construction and `PipelineOutput` validation.
- `ingest-client.ts` owns `/ingest` FormData construction and accepted-response validation.
- `status-client.ts` owns `/status/{taskId}` calls.
- `accepted-task-readiness.ts` owns post-`/ingest` accepted-task visibility checks.
- `ingest-completion-readiness.ts` owns accepted task completion polling.
- `embedding-trigger.ts` owns triggering one verified chunk embedding job.
- `contract-parity.ts` owns offline parity checks between `types/pipeline.ts` and `../data-pipeline/output/schemas.py`.
- `__tests__/live-handshake-fixture.ts` owns live preview/ingest fixtures.

## Transport Rules

- All WebApp -> data-pipeline calls must go through `lib/pipeline/*` Adapters.
- Routes and business Modules must not assemble `DATA_PIPELINE_URL`, HMAC headers, and `fetch` directly.
- Keep `trust-adapter.ts` as the only place that constructs HMAC auth headers.
- Keep `http-client.ts` as the shared transport Seam.
- Classify pipeline network failures in `http-client.ts` as `status: 0` with a `network_error:*` body.
- Business clients must use `response.ts` helpers so plain-text 500s remain diagnosable.

## Contract Values

- Pipeline JSON wire `docType` values are lowercase: `regulation`, `announcement`, `notice`, `interpretation`, `case`, `guide`.
- Prisma enum values such as `NOTICE` are database/internal values unless `doc-type-mapping.ts` maps them explicitly.
- Do not pass uppercase Prisma enum values into `TaxMetadata` / `PipelineOutput`.

## Live Handshake

- WebApp owns `SourceDocument` identity. Create the SourceDocument row before calling pipeline `/ingest`.
- `/ingest` is task-start only. It may create/update `ingest_tasks` and generated chunks, but must not create the parent SourceDocument.
- Compute `fileHash` as SHA-256 of uploaded bytes. Never use `documentId`, file name, or random strings as fake hashes.
- Live ingest tests require `DATABASE_URL` so they can create and clean the parent SourceDocument.
- Reuse `live-handshake-fixture.ts` for canonical uploaded bytes, lowercase wire `docType`, SHA-256 hash, admin actor, setup, and cleanup.
- After `/ingest`, use `accepted-task-readiness.ts`; do not treat 202 alone as readiness.

## Error Mode

- If WebApp reports `Unexpected token ... Internal Server Error`, inspect pipeline/uvicorn logs. It is usually a non-JSON 500 symptom, not the root cause.
- `app/api/pipeline/status/route.ts` must map transport `status: 0` to HTTP `502` with `{ error: "pipeline_unavailable", detail }`; never pass status `0` to `NextResponse`.

## Tests

Add Adapter seam tests for each pipeline call: signed path, method, actor, non-OK handling, response parsing, and network failure handling.

Run `lib/pipeline/__tests__/contract-parity.test.ts` whenever the JSON contract changes.
