# AGENTS.md

Local rules for the WebApp engine. Also read the nearest subdirectory `AGENTS.md` for the Module you touch.

## Commands

```powershell
pnpm install
pnpm prisma generate
pnpm prisma migrate dev --name <name>
pnpm dev
pnpm typecheck
pnpm test
pnpm build
$env:NEXT_DISABLE_STANDALONE="true"; pnpm build
pnpm acceptance:plan
pnpm release:readiness
pnpm smoke:e2e:live
pnpm smoke:providers
```

`pnpm prisma generate` is required before `typecheck` or `build` when Prisma schema/enums have changed.

Use `pnpm test` for full validation. It runs `vitest run --pool=forks`; do not change it back to plain `vitest run` unless the Windows/Node/Vite teardown issue is revalidated.

If local Windows build fails after compile/typecheck/prerender with `EPERM ... symlink ... .next\standalone`, treat it as a local symlink-permission problem. Rerun local validation with `NEXT_DISABLE_STANDALONE=true`; do not remove `output: "standalone"` from release/Docker configuration.

## Prisma and Migrations

- Prisma owns all database DDL, including pgvector manual SQL and `ingest_tasks`.
- The initial migration folds Prisma schema plus HNSW index, metadata GIN index, `expire_date` partial index, `ingest_tasks`, and current-chunk invariant.
- Keep historical manual SQL snippets in `prisma/manual-sql/`, never as child directories under `prisma/migrations/`.
- `prisma/__tests__/migration-contract.test.ts` is the offline guard for folded manual DDL.
- A full migration drift check needs a live PostgreSQL shadow database.

## WebApp Module Rules

- Keep API routes thin. Business rules belong in `lib/knowledge/*`, `lib/pipeline/*`, or another owning Module.
- `lib/db/queries/*` performs data I/O only. Do not add prompt assembly, evidence policy, or domain orchestration there.
- API routes must validate external request bodies at runtime before calling domain Modules. Do not cast `await request.json()` directly to an internal type.
- Next.js App Router route files must export only supported route handlers and route config. Do not export parser or validation helpers from `route.ts` just for tests; move testable helpers to an owning Module under `lib/*` or test the route's public behavior.
- Upload and preview routes must validate `File` metadata with `lib/knowledge/upload-validation.ts` before reading bytes, creating SourceDocuments, or calling data-pipeline. Return safe error codes; do not echo raw paths, filenames, or internal exceptions.
- Query and pagination params must be normalized to finite safe values at the route boundary. Invalid numeric params must not reach DB query Modules as `NaN`.
- Admin/action API routes should use `lib/knowledge/admin-action-adapter.ts` for actor extraction, safe JSON parsing, and structured domain error responses instead of duplicating header parsing or string-matching thrown errors.
- Role/permission failures such as `forbidden_requires_role:*` must map to HTTP `403`. Validation/domain-state failures normally map to `400`.
- `TRUST_PROXY_AUTH=true` requires `PROXY_SHARED_SECRET`; routes must pass `x-proxy-shared-secret` into `resolveActor` so client-forged `X-User-Roles` cannot be trusted directly.
- Client components may call browser adapters and render presenters; they must not import Prisma or own server domain state.
- Code-review execution plans are advisory. Before applying them, reconcile with this file, the nearest Module `AGENTS.md`, and `caishui-webapp-architecture_v2_1.md`; reject suggestions that export unsupported helpers from App Router route files, bypass upload validation through environment flags, or break Node-run runbook CLI imports.

## Environment and Secrets

- Do not commit real or test provider keys.
- Provider smoke reads keys from environment only.
- Live E2E smoke must not require DeepSeek or SiliconFlow keys; provider checks are isolated in `pnpm smoke:providers`.
- For local Windows UI/live validation, set secrets and service env in the parent PowerShell process, then start the child process so it inherits env. Do not build nested `powershell -Command` strings that contain unescaped URLs, connection strings, shared secrets, or API keys; PowerShell may strip quotes and run those values as commands.
- If temporary logs are needed while diagnosing startup, write them outside the repo, delete them immediately after reading, and assume they may contain env-derived secrets.
- Stop only known validation PIDs or the exact port owner you started. Do not use broad process kills such as `Stop-Process -Name node`.

## Generated Artifacts

- Keep generated caches in ignored locations such as `.next/cache`.
- `tsconfig.json` uses `.next/cache/tsconfig.tsbuildinfo`; do not move it back to the root.
- Remove `.next`, `.pytest_cache`, source-zone `__pycache__`, logs, and temp files before architecture review or handoff.
