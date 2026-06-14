# 部署说明

## ⚠️ 禁止 Serverless 部署

两个核心服务都**必须运行在长期存活的容器**上（自托管 Node.js / Python 容器、TKE、轻量应用服务器或 CVM）。**禁止**部署到 Serverless 平台（AWS Lambda、Vercel、腾讯云 SCF、阿里云 FC、CloudBase SSR 等）。

原因（见 [ADR-0008](./docs/adr/0008-resident-process-deployment.md)）：
- `caishui-webapp` 的问答接口需要长时间保持 SSE 连接，并依赖 `AbortSignal` 取消语义。
- `data-pipeline` 的清洗任务依赖常驻进程的 FastAPI `BackgroundTasks`。

**强制手段**：`caishui-webapp` 在启动时（`instrumentation.ts`）检测到已知 Serverless 运行时会**拒绝启动**。仅在你确认平台支持所需连接时长/并发后，才可设 `ALLOW_SERVERLESS=true` 绕过。

## 数据库迁移由 Prisma 独占

所有 DDL（含 `ingest_tasks`）由 Prisma 管理，`data-pipeline` 不运行 Alembic（见 [ADR-0007](./docs/adr/0007-prisma-sole-ddl-migrator.md)）。`data-pipeline` 启动时会校验 `ingest_tasks` 结构，不一致即失败——若报错请先在 `caishui-webapp` 跑 `pnpm prisma migrate deploy`。

## 任务恢复（重启后）

`data-pipeline` 为单进程、单副本。进程重启会丢失在途清洗任务；下次启动时 `reclaim_orphaned_tasks` 会把遗留的 `PENDING`/`PROCESSING` 任务及其 Source Document 标记为 `FAILED`，用户重新上传即可。**不要横向扩展到多副本**——会误判其他副本的在途任务（见 ADR-0008）。

## 推荐配置基线

- PostgreSQL：pgvector ≥ 0.7.x、支持 HNSW（本地 `pgvector/pgvector:pg16`；腾讯云 TDSQL-C Serverless 可用于**数据库**层）。
- `caishui-webapp`：4 vCPU / 8GB 以上常驻容器；`PRISMA_CONNECTION_POOL_MAX=30`。
- 上线前用 k6/Artillery 压测，目标 30 并发问答 p99 < 5s。
- 两套外部 key：`DEEPSEEK_API_KEY`（chat）、`EMBEDDING_API_KEY`（硅基流动 embedding，见 ADR-0006）。
