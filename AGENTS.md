# AGENTS.md

This file is the root guidance for Codex in `J:\tax`. Keep it small: it defines system-wide invariants and points to Module-local `AGENTS.md` files for local rules.

## What This Is

财税知识库问答 WebApp (MVP) is a Chinese tax/finance knowledge-base Q&A system. Its defining constraint is **policy-validity correctness**: serving an expired regulation, stale tax rate, or unsupported "not issued" claim is a severe correctness bug.

Authoritative specs:

- `caishui-webapp-architecture_v2_1.md` — locked architecture v2.1, schema, hard rules, reference flows.
- `docs/prd/caishui-mvp-prd.md` — product scope, module breakdown, testing decisions, non-goals.
- `docs/adr/` — architectural decisions. Do not re-litigate ADRs casually.

## Two-Engine Architecture

There are two independent projects sharing one PostgreSQL+pgvector database and communicating only through a JSON contract.

- `caishui-webapp/` — Next.js 14.2 App Router, TypeScript strict, Prisma. Owns schema, migrations, retrieval, answer generation, and WebApp state.
- `data-pipeline/` — Python 3.11, FastAPI, Pydantic v2. Parses uploads, chunks content, enriches metadata, verifies chunks, embeds verified chunks, and writes to PostgreSQL.

The cross-engine contract is:

- `caishui-webapp/types/pipeline.ts`
- `data-pipeline/output/schemas.py`

These files **must stay structurally mirrored**. When `PipelineOutput`, `ChunkOutput`, or `TaxMetadata` changes, update both sides and the contract parity tests in the same change.

## Load Local Rules

Before changing a Module, read the nearest relevant local `AGENTS.md`.

| Area | Local rules |
| --- | --- |
| WebApp general, Prisma, commands | `caishui-webapp/AGENTS.md` |
| Q&A, retrieval, evidence, answers | `caishui-webapp/lib/knowledge/AGENTS.md` |
| WebApp to pipeline communication | `caishui-webapp/lib/pipeline/AGENTS.md` |
| Local smoke, runbooks, release readiness | `caishui-webapp/lib/smoke/AGENTS.md` |
| QA page UI and SSE presentation | `caishui-webapp/app/qa/components/AGENTS.md` |
| Document/chunk review UI | `caishui-webapp/app/docs/components/AGENTS.md` |
| Admin upload/status UI | `caishui-webapp/app/admin/components/AGENTS.md` |
| Figma/reference asset intake | `caishui-webapp/design/AGENTS.md` |
| Pipeline general, Python env, ingestion | `data-pipeline/AGENTS.md` |
| Pipeline HTTP route adapters | `data-pipeline/api/AGENTS.md` |
| Pipeline writer and embedding lifecycle | `data-pipeline/output/AGENTS.md` |

## Code-Review Blockers

1. **Server/client seam** — Prisma may only be imported in Server Components, API Routes (`app/api/**/route.ts`), Server Actions, server-only Modules, or `lib/db/**`. Never import Prisma in `'use client'` components, browser hooks, or generic client utilities.
2. **Retrieval layer isolation** — all Q&A logic flows through `caishui-webapp/lib/knowledge/`. Never assemble prompts, evidence policy, retrieval filtering, or DeepSeek calls directly from an API route or UI component.
3. **JSON contract parity** — the TypeScript contract and Pydantic schema are one Interface across two engines. Do not use `as`, `Partial`, unchecked casts, permissive `str`, `dict`, or `Any` to hide drift.
4. **Single DDL owner** — Prisma owns database DDL, including `ingest_tasks`. The pipeline mirrors tables for reads/writes only. Do not introduce Alembic or Python `create_all`.
5. **Effective Applicability is mandatory** — default retrieval must never bypass verified/retrievable/current/non-expired gating to improve recall.

## Global Domain Invariants

- **"Not retrieved" is not "doesn't exist."** Answers must distinguish missing evidence from non-existence.
- **Citation Snapshots are immutable.** Source withdrawal/restoration creates annotations; it does not rewrite historical snapshots.
- **Withdraw/restore by default, hard delete by exception.** Hard delete requires explicit admin path, preconditions, and audit.
- **Two providers are separate.** Chat = DeepSeek (`DEEPSEEK_API_KEY`). Embeddings = SiliconFlow `BAAI/bge-large-zh-v1.5`, 1024 dimensions (`EMBEDDING_API_KEY` / `EMBEDDING_BASE_URL`). DeepSeek has no embeddings API.
- **MVP forbidden data states must stay zero before release.** No chunks with `verification_method='auto'`, no chunks with `verification_status='disputed'`, and no failed Answer missing `failed_at`, `error_code`, or `error_message`.
- **Resident process deployment only.** App and pipeline use SSE/BackgroundTasks and must run as long-lived containers, not Serverless. Serverless Postgres is fine.

## Validation Discipline

- Run the narrowest relevant test first during TDD.
- Before calling a Module done, run that engine's full validation.
- For cross-engine contract, ingestion output, retrieval input, answer persistence, or shared vocabulary changes, validate both engines.
- WebApp full tests must use `pnpm test`, which runs `vitest run --pool=forks` to avoid Windows worker teardown false failures.
- Pipeline tests must run from `data-pipeline/` using `.venv` and `.\.venv\Scripts\python -m pytest`.
- Clean generated artifacts before review: `.next`, `.pytest_cache`, source-zone `__pycache__`, logs, temp files, and build output.

## Architecture Hygiene

- Use Module / Interface / Implementation / Seam / Adapter / Depth / Leverage / Locality language when discussing architecture.
- Prefer deep Modules over orchestration in routes or UI components.
- Keep architecture prose, logs, comments, and runbooks aligned with the real call chain in the same change that moves behavior.
- Do not put Module-local history or runbook detail back into this root file. Add it to the nearest local `AGENTS.md`.
