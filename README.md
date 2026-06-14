# 财税知识库问答系统（v2.1 MVP）

面向中国财税知识管理的本地优先问答系统。系统目标不是“让模型自由回答税务问题”，而是建立一条可审计、可追溯、可控边界的知识库问答链路：上传文件、清洗分块、人工/种子核验、向量检索、证据充分性判断、流式回答、引用快照和历史审计。

核心原则：

- **未检索到不等于未出台**：系统不得把知识库零召回解释为法规不存在或尚未发布。
- **默认只检索可信 chunk**：必须满足 verified、retrievable、current、non-expired、embedding completed 等门控。
- **Citation Snapshot 不可变**：历史答案引用的证据快照不得因后续撤出来源而被重写。
- **WebApp 与 Pipeline 分离**：WebApp 拥有 schema、迁移、检索、问答和审计；Pipeline 只负责清洗、分块、核验、embedding 和写入。

## 工程结构

```text
J:\tax
├── caishui-webapp/                  # Next.js 主应用（当前本地目录，尚未初始化 git）
├── data-pipeline/                   # Python 清洗微服务（独立 git 仓库）
├── docs/                            # PRD、代码审查、执行策略、ADR 等文档
├── caishui-webapp-architecture_v2_1.md
├── docker-compose.yml
└── AGENTS.md                        # 根级 agent 规则，只放全局原则
```

## 两个引擎

| 引擎 | 职责 | 技术栈 |
| --- | --- | --- |
| `caishui-webapp/` | 前端页面、管理后台、Prisma schema、检索、证据策略、DeepSeek 流式回答、Answer/Citation 审计 | Next.js 14.2, TypeScript, Prisma, PostgreSQL + pgvector |
| `data-pipeline/` | 文件解析、chunking、元数据抽取、seed/human verification、verified-only embedding、ingest task 状态 | Python 3.11, FastAPI, Pydantic v2, SQLAlchemy async |

跨引擎 JSON contract：

- `caishui-webapp/types/pipeline.ts`
- `data-pipeline/output/schemas.py`

这两个文件必须结构镜像。任何 `PipelineOutput`、`ChunkOutput`、`TaxMetadata`、枚举 wire value 变化，都必须双端同步并跑 contract parity tests。

## 核心文档

- 架构：[`caishui-webapp-architecture_v2_1.md`](./caishui-webapp-architecture_v2_1.md)
- PRD：[`docs/prd/caishui-mvp-prd.md`](./docs/prd/caishui-mvp-prd.md)
- 代码审查 checklist：[`docs/CODE_REVIEW_CHECKLIST.md`](./docs/CODE_REVIEW_CHECKLIST.md)
- 代码审查执行策略：[`docs/CODE_REVIEW_EXECUTION_STRATEGY.md`](./docs/CODE_REVIEW_EXECUTION_STRATEGY.md)
- Pipeline README：[`data-pipeline/README.md`](./data-pipeline/README.md)
- WebApp README：[`caishui-webapp/README.md`](./caishui-webapp/README.md)

## 本地环境

推荐使用 Docker Compose 启动 PostgreSQL + pgvector，再分别启动 WebApp 和 Pipeline。

### PostgreSQL

```powershell
cd J:\tax
docker compose up -d postgres
```

常用本地连接：

```text
postgresql://caishui:localdev_password@127.0.0.1:55432/caishui_db
postgresql+asyncpg://caishui:localdev_password@127.0.0.1:55432/caishui_db
```

WebApp 使用普通 PostgreSQL URL；Pipeline 使用 async SQLAlchemy URL。

### WebApp

```powershell
cd J:\tax\caishui-webapp
pnpm install
pnpm prisma generate
pnpm dev
```

常用验证：

```powershell
pnpm typecheck
pnpm test
pnpm acceptance:plan
pnpm release:readiness
```

### Data Pipeline

```powershell
cd J:\tax\data-pipeline
py -3.11 -m venv .venv
$env:PYTHONUTF8="1"
.\.venv\Scripts\python -m pip install -r requirements.txt
.\.venv\Scripts\python -m pytest
```

本地服务：

```powershell
$env:PYTHONUTF8="1"
$env:DATABASE_URL="postgresql+asyncpg://caishui:localdev_password@127.0.0.1:55432/caishui_db"
$env:PIPELINE_SHARED_SECRET="local-smoke-secret"
.\.venv\Scripts\python -m uvicorn api.main:app --host 127.0.0.1 --port 8000
```

## Provider

- Chat provider：DeepSeek Chat API，环境变量 `DEEPSEEK_API_KEY`
- Embedding provider：SiliconFlow OpenAI-compatible API
  - `EMBEDDING_API_KEY`
  - `EMBEDDING_BASE_URL=https://api.siliconflow.cn/v1`
  - model：`BAAI/bge-large-zh-v1.5`
  - dimension：`1024`

Provider smoke 独立于 live E2E smoke：

```powershell
cd J:\tax\caishui-webapp
pnpm smoke:providers
```

## 最终验收顺序

WebApp：

```powershell
cd J:\tax\caishui-webapp
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

Pipeline：

```powershell
cd J:\tax\data-pipeline
$env:PYTHONUTF8="1"
.\.venv\Scripts\python -m pytest
.\.venv\Scripts\python -m acceptance_runbook
```

## 开发规则

每个模块都有局部 `AGENTS.md`。修改前读取最近的规则文件：

- 根规则：[`AGENTS.md`](./AGENTS.md)
- WebApp：[`caishui-webapp/AGENTS.md`](./caishui-webapp/AGENTS.md)
- Knowledge module：[`caishui-webapp/lib/knowledge/AGENTS.md`](./caishui-webapp/lib/knowledge/AGENTS.md)
- Pipeline：[`data-pipeline/AGENTS.md`](./data-pipeline/AGENTS.md)

重要边界：

- 不在 client component 中 import Prisma。
- 不在 route/UI 中拼 prompt、直接调 DeepSeek 或绕过 `lib/knowledge/`。
- 不用 Pipeline 创建 SourceDocument；`ingest_tasks.document_id` 必须引用 WebApp 已创建的 `source_documents`。
- 不把 provider failure 降级成 `NO_EVIDENCE`。
- 不把“未检索到”说成“未出台/不存在”。

## Git 状态说明

当前只有 `data-pipeline/` 是独立 git 仓库，远端为：

```text
https://github.com/seannet888/caishui-data-pipeline.git
```

`J:\tax` 根目录和 `caishui-webapp/` 当前不是 git 仓库；根 README 与 WebApp README 是本地项目文档，后续若要上传完整 WebApp，需要先初始化或绑定对应远端仓库。
