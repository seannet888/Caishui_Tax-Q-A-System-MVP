# Caishui WebApp

财税知识库问答系统的 WebApp 引擎。该目录负责页面、管理后台、Prisma schema、检索、证据策略、答案生成、引用快照和历史审计。

> 当前目录尚未初始化 git。整体项目说明见 `J:\tax\README.md`，架构说明见 `J:\tax\caishui-webapp-architecture_v2_1.md`。

## Responsibilities

- Render QA, Docs, and Admin pages.
- Own Prisma schema and migrations.
- Own retrieval gates and evidence policy.
- Generate deterministic answers for no-evidence / clarification cases.
- Stream DeepSeek answers when evidence is sufficient.
- Persist Answer records, immutable Citation Snapshots, and audit metadata.
- Communicate with `data-pipeline` through signed HTTP clients and mirrored JSON contracts.

## Non-goals

- Does not parse source files directly.
- Does not create embeddings directly for pipeline-owned ingestion.
- Does not loosen Effective Applicability gates to improve recall.
- Does not treat provider failures as `NO_EVIDENCE`.
- Does not treat browser-generated `conversationId` as production authorization.

## Key Modules

```text
app/qa/components/                 # QA UI, SSE client session, history hydration
app/docs/components/               # document lifecycle and chunk review UI
app/admin/components/              # upload, preview, ingest status UI
app/api/                           # thin HTTP adapters
lib/knowledge/                     # retrieval, evidence, answers, citations, lifecycle
lib/pipeline/                      # signed WebApp -> data-pipeline clients
lib/smoke/                         # local smoke, provider smoke, final acceptance runbooks
lib/db/queries/                    # DB I/O only
prisma/                            # Prisma schema and migrations
types/pipeline.ts                  # TypeScript half of WebApp/Pipeline contract
```

Read the nearest `AGENTS.md` before editing a module.

## Local Setup

```powershell
cd J:\tax\caishui-webapp
pnpm install
pnpm prisma generate
```

Typical local environment:

```powershell
$env:DATABASE_URL="postgresql://caishui:localdev_password@127.0.0.1:55432/caishui_db"
$env:DATA_PIPELINE_URL="http://127.0.0.1:8000"
$env:PIPELINE_SHARED_SECRET="local-smoke-secret"
$env:PROMPT_TEMPLATE_VERSION="v1.1"
```

Provider smoke additionally needs:

```powershell
$env:EMBEDDING_API_KEY="..."
$env:EMBEDDING_BASE_URL="https://api.siliconflow.cn/v1"
$env:DEEPSEEK_API_KEY="..."
```

Never commit real API keys.

## Run

```powershell
pnpm dev
```

If port `3000` is occupied, Next may bind another port. Validate the actual bound port before browser testing.

### UI Rendering Troubleshooting

If a page renders as unstyled HTML, the most likely local-dev cause is a stale `.next` cache where the HTML references `/_next/static/css/app/layout.css` but the CSS asset returns `404`.

First verify the symptom:

```powershell
$html = (Invoke-WebRequest -Uri http://127.0.0.1:3002/qa -UseBasicParsing).Content
$css = [regex]::Match($html, 'href="([^"]+\.css[^"]*)"').Groups[1].Value
Invoke-WebRequest -Uri ("http://127.0.0.1:3002" + $css) -UseBasicParsing
```

If the CSS request returns `404`, restart the dev server with a clean cache:

```powershell
# Find the exact Next dev server PID for the tested port.
Get-NetTCPConnection -LocalPort 3002 -State Listen

# After confirming the PID belongs to the current Next/node dev server:
Stop-Process -Id <PID> -Force

# Clear only the WebApp Next cache.
Remove-Item -LiteralPath 'J:\tax\caishui-webapp\.next' -Recurse -Force

# Restart on the tested port.
cd J:\tax\caishui-webapp
pnpm exec next dev -p 3002
```

Then hard-refresh the browser with `Ctrl + F5`.

Do not use broad process kills such as `Stop-Process -Name node`; stop only the exact port owner you verified.

## Test

```powershell
pnpm typecheck
pnpm test
```

Focused examples:

```powershell
pnpm vitest run lib/pipeline/__tests__/contract-parity.test.ts
pnpm vitest run lib/knowledge/__tests__/chat-turn.test.ts
pnpm vitest run app/qa/components/__tests__
```

## Build

Local Windows validation may need standalone output disabled if symlink permissions block `.next/standalone`:

```powershell
$env:NEXT_DISABLE_STANDALONE="true"
pnpm build
```

Do not remove `output: "standalone"` from release/Docker configuration just to bypass local Windows symlink issues.

## Final Acceptance

```powershell
pnpm acceptance:plan
pnpm vitest run prisma/__tests__/migration-contract.test.ts
pnpm vitest run lib/pipeline/__tests__/contract-parity.test.ts
pnpm typecheck
pnpm test
$env:NEXT_DISABLE_STANDALONE="true"; pnpm build
pnpm release:readiness
pnpm smoke:e2e:live
pnpm smoke:providers
```

Notes:

- `pnpm smoke:e2e:live` validates WebApp <-> Pipeline <-> DB without DeepSeek/SiliconFlow.
- `pnpm smoke:providers` validates external provider auth and response shape only.
- `pnpm release:readiness` requires a reachable `DATABASE_URL`.

## Architecture Rules

- API routes stay thin; domain behavior belongs in `lib/knowledge/*` or `lib/pipeline/*`.
- App Router `route.ts` files export only supported handlers/config.
- Upload and preview routes must use `lib/knowledge/upload-validation.ts` before reading bytes or calling Pipeline.
- Retrieval must preserve Effective Applicability gates.
- Citation Snapshots are immutable; source lifecycle changes add annotations instead of rewriting history.
- WebApp/Pipeline contract changes must update both `types/pipeline.ts` and `data-pipeline/output/schemas.py`.
