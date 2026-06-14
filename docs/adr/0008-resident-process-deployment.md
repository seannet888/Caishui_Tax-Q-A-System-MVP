# Resident-process deployment: no Serverless; background tasks are best-effort with startup reclaim

Both core services run as **long-lived, self-hosted containers**, never on Serverless (Lambda/Vercel/SCF/FC/CloudBase SSR). The webapp holds long-lived SSE connections for streaming answers; the pipeline relies on FastAPI `BackgroundTasks` in a resident process. Background cleaning tasks are **best-effort, not durable**: a process restart loses in-flight tasks, and the pipeline **reclaims** them on the next boot.

## Why no Serverless

Streaming chat needs connection durations, `AbortSignal` semantics and concurrency that Serverless SSR/function platforms do not reliably provide; resident `BackgroundTasks` need a process that outlives a request. This is a constraint not visible in the code, so it is enforced two ways: a boot guard (`instrumentation.ts`) that refuses to start when a known serverless runtime is detected (escape hatch `ALLOW_SERVERLESS=true`), plus `DEPLOYMENT.md`.

## Why best-effort tasks (no Celery/Redis)

MVP deliberately avoids a durable job queue. The accepted cost: a restart strands in-flight tasks. Because the pipeline is **single-process / single-replica**, any `PENDING`/`PROCESSING` `ingest_tasks` row at startup is necessarily orphaned, so `reclaim_orphaned_tasks` marks them (and their `SourceDocument`) `FAILED` with no time threshold; the user re-uploads.

## Consequences

- Do not deploy on Serverless to "save cost", and do not add Celery/Redis to make tasks durable, without revisiting this ADR.
- The single-replica assumption is load-bearing for orphan reclaim — running multiple pipeline replicas would wrongly fail a peer's live tasks. Scaling out requires a real queue first.
- A future user-facing "re-clean" retry button (deferred) would complement, not replace, the startup reclaim.
