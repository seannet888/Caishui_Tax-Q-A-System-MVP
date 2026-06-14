# AGENTS.md

Local rules for smoke tests, release readiness, provider checks, and runbook CLIs.

## Owning Modules

- `e2e-smoke-harness.ts` owns the local E2E smoke orchestration contract.
- `e2e-smoke-adapters.ts` wires harness steps to public WebApp Modules.
- `deterministic-smoke-retrieval.ts` owns the live smoke retrieval substitute.
- `live-e2e-smoke-runner.ts` owns opt-in live E2E smoke execution and cleanup verification.
- `live-e2e-smoke-preflight.ts` owns environment, pipeline health, and DB reachability preflight.
- `live-e2e-smoke-diagnostics.ts` owns developer-facing diagnostics.
- `live-e2e-smoke-runbook.ts` and `scripts/run-live-e2e-smoke.mjs` own `pnpm smoke:e2e:live`.
- `provider-connectivity.ts` owns SiliconFlow embedding and DeepSeek streaming connectivity checks.
- `provider-connectivity-diagnostics.ts` owns provider failure classification and operator hints.
- `provider-connectivity-runbook.ts` and `scripts/run-provider-smoke.mjs` own `pnpm smoke:providers`.
- `migration-readiness-runbook.ts` owns Prisma migration readiness instructions.
- `final-acceptance-runbook.ts` and `scripts/print-final-acceptance-plan.mjs` own final local acceptance planning.
- `runbook-format.js` owns tiny shared runbook formatting helpers used by Node-run runbook Modules; `runbook-format.d.ts` owns the TypeScript surface for those helpers.
- `scripts/pnpm-spawn.mjs` owns Node CLI child-process launching for pnpm commands.

## Live E2E Isolation

- `pnpm smoke:e2e:live` validates WebApp-owned SourceDocument creation, pipeline ingest/chunk persistence, review, embedding trigger, DB cleanup, and deterministic answer persistence.
- It must not require `DEEPSEEK_API_KEY` or `EMBEDDING_API_KEY`.
- Use `deterministic-smoke-retrieval.ts`; it may only return chunk IDs verified during the current smoke run.
- Do not call production retrieval, query embedding, DeepSeek, or SiliconFlow from the default live E2E smoke runner.
- Step exceptions must become `{ ok: false, failedStep, reason, trace }` so diagnostics and cleanup still run.
- Cleanup failure must return `cleanup: { ok: false, reason, residualRows? }` rather than masking harness results.

## Provider Smoke Isolation

- Use `pnpm smoke:providers` for external provider auth/shape checks.
- Provider smoke validates SiliconFlow embeddings and DeepSeek streaming only.
- Provider smoke must not touch DB, data-pipeline, SourceDocument, chunks, or Answer state.
- Do not interpret provider authentication failures as pipeline ingest regressions.

## Runbook CLI Rules

- Runbook CLIs must use `scripts/pnpm-spawn.mjs`.
- On Windows, that helper launches `cmd.exe /d /s /c pnpm ...` with `shell=false`, avoiding Node `DEP0190` warning pollution.
- Runbook Modules that are imported directly by `.mjs` scripts must use Node-resolvable relative imports. Do not introduce `@/` aliases or extensionless TypeScript helper imports on that direct Node path.
- If a helper is shared by runbook Modules imported directly from Node, keep it as a runtime `.js` file with `.d.ts` types, or keep the helper local. Do not refactor it into a TS-only file unless the CLI loader is changed and tested.
- `scripts/run-live-e2e-smoke.mjs` must preflight pipeline `/health` and `DATABASE_URL` TCP reachability before spawning Vitest.
- If dependencies are offline, print concise runbook failure text instead of leaking Vitest/Prisma stacks.
- For ad hoc UI/live validation on Windows, start local services with env inherited from the current process. Do not pass provider keys, `DATABASE_URL`, or `PIPELINE_SHARED_SECRET` through nested `powershell -Command` strings; quote loss can leave services running without env and can echo secrets into diagnostic logs.
- When a service chooses a fallback port because `3000` or `3001` is busy, validate the actual bound port before opening the browser. Do not assume the requested port is the tested instance.
- Before running the local Next build, stop any dev server and remove `.next`. Do not run `pnpm build` while `next dev` is active; shared `.next` state can make route collection fail with stale `PageNotFoundError`.
- Cleanup must target exact validation PIDs or exact port owners from `Get-NetTCPConnection`. Do not kill all `node`, `pnpm`, or `python` processes.

## Final Acceptance Order

Use `pnpm acceptance:plan` to project runnable vs environment-blocked steps. The canonical sequence is:

1. Migration contract.
2. Contract parity.
3. Typecheck.
4. Full WebApp tests.
5. Local build.
6. Release readiness DB assertions.
7. Live E2E smoke.
8. Provider smoke.
