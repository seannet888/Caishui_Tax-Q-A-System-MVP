# 财税知识库问答 WebApp — MVP 架构设计文档 v2.1

> 精简版 MVP 架构方案，面向单人全栈开发。经过多轮深度审查，聚焦最小可信闭环。  
> **核心变更**：Embedding 模型固定为 SiliconFlow 托管的 `BAAI/bge-large-zh-v1.5`（1024 维）；验证为 chunk 级；任务恢复与 Serverless 防护已落地。  
> **最后更新**：2026-06-15

---

## 一、技术栈锁定清单

| 层次                | 技术                                      | 锁定版本             | 选型理由              |
| ----------------- | --------------------------------------- | ---------------- | ----------------- |
| **前端框架**          | Next.js (App Router)                    | `14.2.x`         | SSR 适合知识库，稳定 LTS  |
| **类型系统**          | TypeScript                              | `5.4.x`          | 严格模式，禁止 `any`     |
| **ORM**           | Prisma                                  | `5.14.x`         | 迁移成熟，支持 pgvector  |
| **数据库**           | PostgreSQL + pgvector                   | `16.x` + `0.7.x` | HNSW 索引，余弦距离      |
| **Python 运行时**    | Python                                  | `3.11.x`         | 异步支持完善            |
| **Python Web 框架** | FastAPI                                 | `0.111.x`        | 异步原生，自动生成 OpenAPI |
| **Python 测试环境**  | pytest + pytest-asyncio                 | `8.2.2` / `0.23.7` | 支持 async 测试与 `asyncio_mode=auto` |
| **Embedding 模型**  | SiliconFlow 托管 `BAAI/bge-large-zh-v1.5` | 1024 维           | 见 ADR‑0006        |
| **Chat API**      | DeepSeek Chat API                       | -                | 流式，付费版            |
| **OpenAI SDK 兼容层** | `openai` + `httpx`                     | `1.35.13` / `0.27.2` | SiliconFlow 使用 OpenAI-compatible SDK；`httpx>=0.28` 不兼容 |
| **PDF 解析**        | `pymupdf4llm`                           | `0.0.17`         | 输出 Markdown，保留表格  |
| **Excel/CSV 解析**  | `pandas`                                | `2.2.x`          | 表格转结构化文本          |
| **异步处理**          | FastAPI `BackgroundTasks`               | MVP 内置           | 清洗任务异步；启动时回收僵尸任务  |
| **容器化**           | Docker + Docker Compose                 | `26.x`           | 开发与部署一致           |
| **包管理**           | pnpm (前端) + pip (后端)                    | 9.x / 最新         | 明确分离              |

**已删除的依赖**：LangChain、Celery/Redis、全文检索、重排序模型、Serverless 部署支持（见 ADR‑0008）。

### 1.1 Python 环境与依赖锁定

`data-pipeline` 必须使用项目级 Python 3.11 虚拟环境运行，不使用全局 Anaconda 或系统默认 `pytest`。本地已验证组合：

```powershell
cd data-pipeline
py -3.11 -m venv .venv
$env:PYTHONUTF8="1"
.\.venv\Scripts\python -m pip install -r requirements.txt
.\.venv\Scripts\python -m pytest
```

**依赖兼容约束**：

- `requirements.txt` 必须显式固定 `httpx==0.27.2`。
- 原因：`openai==1.35.13` 构造 `AsyncOpenAI` 时仍会向底层 httpx client 传入 legacy `proxies` 参数；`httpx>=0.28` 已移除该参数，会导致 `AsyncClient.__init__() got an unexpected keyword argument 'proxies'`。
- Windows 下安装依赖或运行测试时建议设置 `PYTHONUTF8=1`，避免 pip 按 GBK 读取 UTF-8 的 `requirements.txt` 或测试夹具。
- 不得通过删除 `pyproject.toml` 中的 `asyncio_mode = "auto"` 来掩盖环境问题；正确修复是安装锁定的 `pytest-asyncio==0.23.7`。

### 1.2 WebApp 测试运行约束

`caishui-webapp` 的全量测试入口为：

```powershell
cd caishui-webapp
pnpm test
```

`pnpm test` 固定执行 `vitest run --pool=forks`。原因：当前 Windows/Node/Vite 组合下，plain `vitest run` 可能在所有测试已通过后，于 worker teardown 阶段触发 `FATAL ERROR: v8::ToLocalChecked Empty MaybeLocal`，导致 false red exit code。窄测试仍可直接使用 `pnpm vitest run <file>`；全量验证应使用 package script。

`next.config.mjs` 默认保留 `output: "standalone"` 作为 Docker/部署输出。Windows 本地若未启用 symlink 权限，`pnpm build` 可能在编译、类型检查、静态页生成均通过后，于 `.next/standalone` copy traced files 阶段报 `EPERM: operation not permitted, symlink ...`。这种情况下可使用：

```powershell
$env:NEXT_DISABLE_STANDALONE="true"
pnpm build
```

完成本地应用构建校验；正式 Docker/release 构建仍应使用默认 standalone 输出。

---

## 二、项目目录结构（当前示意）

```
caishui-webapp/               # Next.js 主工程
├── prisma/
│   └── schema.prisma         # 见第三章
├── app/
│   ├── qa/                   # 问答界面
│   │   └── components/
│   │       ├── ChatWindow.tsx            # UI 渲染
│   │       ├── qa-client-session.ts      # conversation identity、history hydration、chat fetch、SSE 消费
│   │       ├── chat-sse-protocol.ts      # 浏览器侧 SSE 协议解析
│   │       └── qa-page-view-model.ts     # QA 页面消息状态投影
│   ├── docs/
│   │   └── components/
│   │       ├── DocumentLifecycleActions.tsx
│   │       └── document-lifecycle-client.ts
│   ├── admin/upload/         # 上传管理
│   ├── api/chat/route.ts
│   ├── api/chunks/[chunkId]/verify/route.ts
│   ├── api/chunks/[chunkId]/reject/route.ts
│   ├── api/documents/[docId]/route.ts
│   ├── api/pipeline/status/route.ts
│   ├── api/pipeline/preview/route.ts
│   └── api/upload/route.ts
├── lib/
│   ├── knowledge/
│   │   ├── chat-turn.ts        # 单轮问答编排：上下文 → 证据策略 → 检索 → 生成输入
│   │   ├── answer-generation.ts
│   │   ├── answer.ts           # Answer 状态机/持久化 Adapter
│   │   ├── answer-read-model.ts
│   │   ├── deterministic-answer.ts
│   │   ├── retrieval-failure-answer.ts
│   │   ├── release-readiness.ts
│   │   ├── release-readiness-diagnostics.ts
│   │   ├── domain-error.ts
│   │   ├── admin-action-adapter.ts
│   │   ├── upload-validation.ts # upload/preview 文件输入边界校验
│   │   ├── source-ingestion.ts
│   │   ├── doc-type-mapping.ts
│   │   ├── preview-persistence.ts
│   │   ├── chunk-review.ts
│   │   ├── document-review-read-model.ts
│   │   ├── source-withdrawal.ts
│   │   ├── source-hard-delete.ts
│   │   ├── retriever.ts
│   │   ├── temporal.ts          # Temporal Intent（时间过滤）
│   │   ├── rerank.ts            # Latest Intent + 权威/管辖地重排
│   │   ├── prompt-templates.ts
│   │   └── stream-handler.ts
│   ├── pipeline/
│   │   ├── contract-parity.ts   # WebApp/Pipeline JSON contract parity guard
│   │   ├── trust-adapter.ts      # WebApp → data-pipeline HMAC 签名
│   │   ├── response.ts           # Pipeline HTTP 响应解析与错误格式化
│   │   ├── http-client.ts        # Pipeline shared transport: URL/sign/fetch/body parse
│   │   ├── ingest-client.ts      # /ingest pipeline client
│   │   ├── accepted-task-readiness.ts # /ingest accepted 后的 /status 可读性校验
│   │   ├── ingest-completion-readiness.ts # accepted 后轮询到 SUCCESS/FAILED
│   │   ├── status-client.ts      # /status/{taskId} pipeline client
│   │   ├── preview-client.ts     # /preview pipeline client
│   │   ├── embedding-trigger.ts  # 单个 verified chunk 的 embedding job 触发
│   │   └── __tests__/live-handshake-fixture.ts # live 握手测试夹具
│   ├── smoke/
│   │   ├── e2e-smoke-harness.ts # 本地 E2E smoke 编排契约
│   │   ├── e2e-smoke-adapters.ts # WebApp smoke step adapter factory
│   │   ├── deterministic-smoke-retrieval.ts # live smoke 专用确定性检索
│   │   ├── live-e2e-smoke-runner.ts # opt-in live E2E smoke runner
│   │   ├── live-e2e-smoke-preflight.ts # live smoke 环境与依赖预检
│   │   ├── live-e2e-smoke-diagnostics.ts # live smoke 诊断文本投影
│   │   ├── live-e2e-smoke-runbook.ts # live smoke 操作入口说明
│   │   ├── provider-connectivity.ts # SiliconFlow/DeepSeek 供应商连通性 smoke
│   │   ├── provider-connectivity-diagnostics.ts # provider smoke 失败分类与排障文本
│   │   ├── provider-connectivity-runbook.ts # provider smoke 操作入口说明
│   │   ├── migration-readiness-runbook.ts # Prisma 迁移/漂移验收说明
│   │   ├── final-acceptance-runbook.ts # 最终本地验收顺序
│   │   └── runbook-format.js # Node CLI-compatible runbook formatting helpers
│   ├── db/
│   │   └── client.ts
│   └── utils/
├── scripts/
│   ├── run-live-e2e-smoke.mjs # pnpm smoke:e2e:live 入口
│   ├── run-provider-smoke.mjs # pnpm smoke:providers 入口
│   ├── run-release-readiness.mjs # pnpm release:readiness 入口
│   └── pnpm-spawn.mjs # Windows-safe pnpm child-process helper
├── types/pipeline.ts
├── design/
│   ├── README.md             # Design Asset Intake 规则
│   ├── references/           # 用户提供的参考页面/截图
│   ├── figma-screens/        # Figma 页面级导出
│   └── notes/                # prompt 与设计备注
├── public/ui-assets/figma/   # Figma 运行时素材导出
├── instrumentation.ts        # Serverless 启动防护
└── docker-compose.yml

data-pipeline/                # Python 清洗微服务
├── api/
│   ├── main.py
│   ├── routers/ingest.py, status.py, preview.py, embedding.py
├── acceptance_runbook.py     # pipeline 最终本地验收顺序与环境防误用说明
├── embedding_job.py          # 单个 verified chunk 的 embedding job
├── loaders/
├── transformers/
│   ├── chunker.py
│   ├── embedder.py           # SiliconFlow 1024 维
│   └── metadata_enricher.py
├── output/writer.py
├── output/embedding_lifecycle.py
├── db/
│   ├── connection.py
│   ├── models.py             # 手工镜像 ingest_tasks
│   ├── schema_check.py       # 启动时检测 drift
│   └── recovery.py           # 启动时回收孤儿任务
└── requirements.txt
```

---

## 三、PostgreSQL Schema（关键修改：vector(1024)，无文档级验证）

```prisma
// prisma/schema.prisma (v2.1)

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [pgvector(map: "vector")]
}

enum ProcessingStatus { PENDING PROCESSING COMPLETED FAILED }
enum DocType { REGULATION ANNOUNCEMENT NOTICE INTERPRETATION CASE GUIDE }
enum FileType { PDF MD XLSX CSV }
enum EmbeddingStatus { PENDING PROCESSING COMPLETED FAILED }
enum RetrievalStatus { RETRIEVABLE WITHDRAWN }
enum AnswerStatus { GENERATING COMPLETED FAILED }

model SourceDocument {               // 重命名：明确“源文档”概念
  id              String         @id @default(cuid())
  title           String
  file_name       String
  file_type       FileType
  file_size       Int
  file_path       String?
  file_hash       String         @unique

  processing_status ProcessingStatus @default(PENDING)
  retrieval_status  RetrievalStatus  @default(RETRIEVABLE)
  error_message   String?

  doc_type        DocType?
  doc_number      String?
  publish_date    DateTime?
  effective_date  DateTime?
  expire_date     DateTime?
  jurisdiction    String?
  issuing_body    String?
  source_channel  String?         // 采集渠道，如"国家税务总局官网"（来源渠道，非 embedding 提供商）
  authority_rank  Int?

  created_at      DateTime       @default(now())
  updated_at      DateTime       @updatedAt
  processed_at    DateTime?

  chunks          KnowledgeChunk[]

  @@index([processing_status])
  @@index([retrieval_status])
  @@map("source_documents")
}

model KnowledgeChunk {
  id              String    @id @default(cuid())          // Chunk Row ID
  pipeline_chunk_id String  // Chunk Location ID = SHA256(file_hash + chunk_index)，见 ADR-0001
  document_id     String    // 外键指向 SourceDocument（字段名保持 document_id，见 ADR-0001）
  document        SourceDocument @relation(fields: [document_id], references: [id], onDelete: Restrict)

  content         String
  content_hash    String    // Content Hash = SHA256(content)
  chunk_index     Int
  chunk_type      String    @default("text")

  embedding       Unsupported("vector(1024)")?   // 1024 维，bge-large-zh-v1.5
  embedding_status EmbeddingStatus @default(PENDING)
  embedding_error  String?
  embedding_identity String?   // SHA256(document_id + content_hash + model + dim)
  embedding_model    String?   // "BAAI/bge-large-zh-v1.5"
  embedding_dimension Int?
  embedding_attempts Int       @default(0)
  embedding_last_attempt_at DateTime?

  publish_date    DateTime?
  effective_date  DateTime?
  expire_date     DateTime?
  jurisdiction    String?
  source_channel  String?
  doc_type        DocType?
  authority_rank  Int?

  is_current_version   Boolean   @default(true)
  version_of_provision String?
  verification_status  String    @default("unverified") // "verified" | "unverified" | "rejected" | "disputed"
  verification_method  String?                         // "seed" | "human"
  verified_by          String?
  verified_at          DateTime?
  verification_notes   String?
  provision_type       String    @default("operative")
  answer_role          String?
  retrieval_status     RetrievalStatus @default(RETRIEVABLE)
  withdrawn_at         DateTime?
  withdrawn_by         String?
  withdrawal_reason    String?

  metadata        Json      @default("{}")
  created_at      DateTime  @default(now())
  updated_at      DateTime  @updatedAt                     // 新增更新时间

  @@index([document_id])
  @@index([pipeline_chunk_id])
  @@index([chunk_index])
  @@index([jurisdiction])
  @@index([publish_date])
  @@index([effective_date])
  @@index([authority_rank])
  @@index([is_current_version])
  @@index([verification_status])
  @@index([provision_type])
  @@index([embedding_status])
  @@index([retrieval_status])
  @@map("knowledge_chunks")
}

// Answer, AnswerCitation, CitationAnnotation, AuditEvent 保持与 v2.0 一致，仅字段名关联到 SourceDocument
// ... (篇幅原因省略，保持原有设计)
```

**重要说明**：

- 模型名改为 `SourceDocument`，表名 `source_documents`，明确“上传文件 + 来源渠道”单元。
- 向量维度 **1024**，对应 `bge-large-zh-v1.5`。
- 无文档级验证字段；`verification_status` 仅在 chunk 上。
- `KnowledgeChunk` 新增 `updated_at`，用于跟踪变更。

---

## 四、清洗微服务 (data-pipeline) 核心适配

### 4.1 Embedder（`embedder.py`）—— SiliconFlow API

`Embedder` 使用 OpenAI-compatible SDK 调用 SiliconFlow。SDK 版本与底层 `httpx` 版本必须按第一章锁定：`openai==1.35.13` + `httpx==0.27.2`。若升级 OpenAI SDK 或 httpx，必须先跑 `data-pipeline` 全量测试，并验证 `AsyncOpenAI(api_key=..., base_url=...)` 可正常构造。

```python
from openai import AsyncOpenAI

class Embedder:
    def __init__(self, api_key: str, base_url: str = "https://api.siliconflow.cn/v1"):
        self.client = AsyncOpenAI(api_key=api_key, base_url=base_url)
        self.model = "BAAI/bge-large-zh-v1.5"
        self.dimension = 1024   # 静态常量，与 Schema 一致

    async def embed(self, text: str) -> list[float]:
        resp = await self.client.embeddings.create(model=self.model, input=text)
        vector = resp.data[0].embedding
        if len(vector) != self.dimension:
            raise ValueError("embedding_dimension_mismatch")
        return vector
```

### 4.2 分块策略（不变，条款正则 + 表格整体）

`data-pipeline/transformers/chunker.py` 必须在调用 embedding lifecycle 之前保证普通文本 chunk 满足 provider-safe 上限：

- 默认参数：目标约 512 字符，最大 `MAX_CHUNK_TOKENS = 1024` 字符，最小 50 字符，重叠 50 字符。
- 优先按标题、条款边界、句号/分号切分；当来源文本缺少标点或条款边界时，必须按最大长度硬切，不能产出超长普通文本 chunk。
- 短标题、短条款或短段落累计到 `pending` 时必须按目标长度及时 flush，并在合并到正文前再次检查最大长度；不得因 pending 累积或合并导致 chunk 超过 `MAX_CHUNK_TOKENS`。
- `400 invalid parameter` 等由超长 input 触发的 embedding provider 错误应视为 pipeline 分块缺陷，而不是可接受的生产失败状态。

### 4.3 元数据抽取（不变，纯正则 + 来源配置）

### 4.4 写入与验证（chunk 级）

- 所有新入库 chunk 若未显式走可信来源路径，初始 `verification_status = 'unverified'`，`embedding = null`。
- **Trusted Source / Seed-Verified（默认 admin 上传 UX）**：管理员上传官方可信来源时，表单默认勾选“可信来源自动核验”，通过显式 `seedVerified=true` 传入 pipeline；pipeline 仍按 chunk 级处理，将结构合规的 chunk 标记为 `verified`、`verification_method = "seed"`，并触发生产 embedding。该路径用于可信官方来源的快速入库，不要求逐条人工审阅。Seed 结构校验只阻断核心质量问题（内容过短、缺来源位置、缺发文机关、缺生效日期等）；无文号文件与 provider-safe 分块造成的句尾疑似截断不得单独阻断可信来源自动核验。
- **Human-Verified**：后台 reviewer 手动标记，填写核验依据。该路径用于异常 chunk、未勾选可信导入的来源、抽检与补救，不作为可信官方来源的默认必经流程。
- `rejected` chunk 入库但 `embedding = null`，不参与检索。

### 4.5 Pipeline Writer / Embedding Lifecycle 模块边界（已落地）

`output/writer.py` 保留 `persist_chunk(...)` 作为 ingestion 的稳定入口，但不再承载 embedding 生命周期分支。生产 embedding 规则集中在 `output/embedding_lifecycle.py`：

```python
async def apply_embedding_lifecycle(chunk, embedder, repo) -> None:
    # unverified / rejected：禁止生产 embedding
    # verified：按 embedding_identity 查找同 Source Document 内已完成向量
    # 未命中：最多自动尝试 3 次；失败只写 embedding_error，不改变 verification_status
    ...
```

**必须遵守**：

- 只有 `verification_status == "verified"` 的 chunk 可以调用 Embedding API。
- `rejected` chunk 必须保留 `verification_notes`，且 `embedding` 必须为 `null`。
- `embedding_identity = SHA256(document_id + content_hash + model + dimension)`，MVP 阶段不引入独立 `EmbeddingRecord` 表。
- 自动重试最多 3 次；达到上限时 `embedding_status = "FAILED"`，`embedding_error = "automatic_retry_limit_reached"`。
- Embedding 失败不得改变 `verification_status`。

### 4.6 Verified Chunk Embedding Trigger / Job（已落地）

Human-Verified 后需要为单个 chunk 触发生产 embedding，但该路径不得复制 writer 中的向量化逻辑。Trusted Source / Seed-Verified 上传则在 ingestion 中通过同一 `output/embedding_lifecycle.py` 自动进入 embedding。当前实现分成两个 Module：

- WebApp：`lib/pipeline/embedding-trigger.ts` 只负责向 data-pipeline 的 `POST /chunks/{chunk_id}/embed` 发起已签名请求，并返回 `{ ok, status, error? }`。
- Pipeline：`embedding_job.py::embed_verified_chunk(...)` 负责读取指定 Knowledge Chunk，校验其仍满足 `verified + RETRIEVABLE + is_current_version`，然后委托 `output/embedding_lifecycle.py::apply_embedding_lifecycle(...)`。
- HTTP Adapter：`api/routers/embedding.py` 只负责 HMAC principal 校验和 `BackgroundTasks.add_task(...)`，不得实现 embedding eligibility。

**必须遵守**：

- `embedding_job.py` 是 `output/embedding_lifecycle.py` 的调用者，不是第二套向量生命周期实现。
- Human Verify 的数据库事务先完成；embedding trigger 失败不得回滚已完成的人工核验，应把失败状态返回给前端/审计链用于后续重试。Seed-Verified 路径中的 embedding 失败同样不得改变 `verification_status`，文档详情页应将其呈现为可重试的 readiness 问题。
- `app/docs/components/chunk-review-response-presenter.ts` 必须将“核验已保存但 embedding trigger 失败”投影为管理员 warning，避免 verified chunk 因未排上向量化任务而静默停留在不可检索状态。
- `app/api/chunks/[chunkId]/embed/route.ts` 提供手动 retry embedding trigger；该 route 只允许 `reviewer` 调用，只触发 `embedding-trigger.ts`，不得重新执行 human verification 或修改 verification 状态。文档详情页通过 `ChunkEmbeddingRetryAction.tsx` 对 blocked chunk 暴露该动作。
- WebApp → data-pipeline 的签名、URL、错误处理应收敛到 `lib/pipeline/*` Adapter；新增 pipeline 调用不得在 route 中重复拼装 HMAC headers。

---

## 五、检索与问答（适配 1024 维）

### 5.1 向量检索 SQL（`retriever.ts`）

```typescript
import { Prisma, EmbeddingStatus, ProcessingStatus, RetrievalStatus } from "@prisma/client";

// 法律门控的"静态"部分（当前版本 + 已核验）。时间维度不在此硬编码，
// 由 buildTemporalFilter(intent, queryDate) 按时间意图参数化注入，经 extraFilter 传入，
// 以支持 as_of / latest_publication 等放宽时效的意图（见 ADR-0004、第 5.2 节）。
const LEGAL_GATES = Prisma.sql`
  AND kc.is_current_version = true
  AND kc.verification_status = 'verified'
`;

const OPERATIONAL_GATES = Prisma.sql`
  AND kc.embedding_status = ${EmbeddingStatus.COMPLETED}::"EmbeddingStatus"
  AND kc.embedding IS NOT NULL
  AND d.retrieval_status = ${RetrievalStatus.RETRIEVABLE}::"RetrievalStatus"
  AND kc.retrieval_status = ${RetrievalStatus.RETRIEVABLE}::"RetrievalStatus"
`;

// ⚠️ 管辖地不在 SQL 过滤（ADR-0004）：全量召回 top-30 后由 rerankByAuthority /
// groupByJurisdiction 在应用层做本地优先 + 全国兜底，再取 top-5。
export async function searchByVector(
  queryEmbedding: number[],
  limit = 30,
  extraFilter: Prisma.Sql = Prisma.empty,   // buildTemporalFilter 注入的时间维度
) {
  const vectorLiteral = `[${queryEmbedding.join(",")}]`;
  const completed = ProcessingStatus.COMPLETED;
  return prisma.$queryRaw`
    SELECT
      kc.id,
      kc.content,
      (kc.embedding <=> ${vectorLiteral}::vector) AS distance,
      1 - (kc.embedding <=> ${vectorLiteral}::vector) AS similarity
    FROM knowledge_chunks kc
    JOIN source_documents d ON kc.document_id = d.id
    WHERE
      d.processing_status = ${completed}::"ProcessingStatus"
      ${LEGAL_GATES}
      ${OPERATIONAL_GATES}
      ${extraFilter}
    ORDER BY distance ASC
    LIMIT ${limit}
  `;
}
```

### 5.2 证据充分性、时间意图、管辖地等逻辑（与 v2.0 一致，仅维度常量调整）

### 5.3 Chat Turn Orchestration（已落地）

`app/api/chat/route.ts` 是薄 SSE Adapter，不直接编排检索、证据策略或确定性答案持久化。单轮问答由 `lib/knowledge/chat-turn.ts` 统一收口：

```typescript
type ChatTurnResult =
  | { kind: "deterministic"; event: ChatStreamEvent }
  | { kind: "generate"; generationInput: AnswerGenerationInput };
```

`planChatTurn(...)` 的职责：

1. 读取最近对话历史，生成 Standalone Query。
2. Standalone Query 无法补全时，持久化确定性澄清答案并返回 `needs_clarification` 事件。
3. 检索前执行 Evidence Policy；地方敏感问题缺管辖地时先澄清，不进入向量检索。
4. 执行 `retrieve(...)`，获得 `chunks + coverageEvidence + queryPlan`。若 query embedding / retrieval provider 在此阶段失败，必须通过 `lib/knowledge/retrieval-failure-answer.ts` 持久化 `status=FAILED` 的 Answer，并向前端返回 `error:retrieval_unavailable`；不得降级为 `no_evidence`，因为系统并未完成知识库检索。
5. 检索后再次执行 Evidence Policy：
   - `no_evidence`：持久化确定性答案，返回 `no_evidence` 事件，不调用模型。
   - `clarify`：持久化确定性澄清答案。
   - `generate`：返回完整 `AnswerGenerationInput`，由 `answer-generation.ts` 负责流式生成。

这样 `/api/chat` 只负责：解析请求、解析 actor、把 deterministic event 包成 SSE，或把 `generationInput` 接到 `generateAnswerEvents(...)`。

### 5.4 Deterministic Answer 审计（已落地）

所有不调用模型的答案也必须进入 Answer 审计链。`lib/knowledge/deterministic-answer.ts` 使用 `model = "deterministic-template"`，并在 `coverage_evidence_snapshot` 中写入：

```json
{
  "deterministicAnswerReason": "needs_clarification"
}
```

允许值仅为：

- `needs_clarification`
- `no_evidence`

`lib/knowledge/answer-read-model.ts` 会把该字段安全投影为 `AnswerHistoryItem.deterministicReason`。未知值不得透传到前端。

### 5.5 Retrieval Failure Answer 审计（已落地）

真实问答中的检索准备失败（尤其是 query embedding provider 鉴权、网络或响应异常）与“零召回”是不同状态：

- **零召回**：检索成功执行，但没有召回可用证据，持久化 `COMPLETED` deterministic no-evidence answer。
- **检索失败**：检索没有成功执行，必须持久化 `FAILED` Answer，并返回前端安全错误事件。

`lib/knowledge/retrieval-failure-answer.ts` 负责：

- 将错误分类为：
  - `query_embedding_auth_failed`
  - `query_embedding_timeout`
  - `query_embedding_failed`
- 写入 `model = "retrieval-readiness"`、`status = "FAILED"`、`failed_at`、`error_code`、`error_message`。
- 在 `coverage_evidence_snapshot.retrievalFailure` 中固化失败码和原始错误消息，供审计排障。
- 前端 SSE 只接收安全文本：

```json
{
  "type": "error",
  "code": "retrieval_unavailable",
  "message": "当前检索服务暂时不可用，无法完成知识库查询。请稍后重试；如果持续出现，请检查 Embedding API 配置。"
}
```

该路径不创建 Citation Snapshot，不调用 DeepSeek，也不输出“当前知识库未收录”等可能误导用户的表述。

### 5.6 Answer / Source Lifecycle 模块边界（已落地）

`lib/knowledge/answer.ts` 只负责 Answer 状态机：

- `startAnswer`
- `appendDraft`
- `finalizeStreamedAnswer`
- `failAnswer`

来源撤出不属于 Answer 生命周期，已拆到 `lib/knowledge/source-withdrawal.ts`：

- 校验 actor 必须为 `admin`。
- 撤出原因不能为空。
- 在一个事务中将 `SourceDocument.retrieval_status` 与关联 `KnowledgeChunk.retrieval_status` 设为 `WITHDRAWN`。
- 为历史 `AnswerCitation` 追加 `CitationAnnotation(annotation_type="source_withdrawn")`，不得改写 Citation Snapshot。
- 写入 `AuditEvent(action="source_withdrawn")`。

来源恢复同样属于 `lib/knowledge/source-withdrawal.ts` 的职责：

- 校验 actor 必须为 `admin`。
- 恢复原因不能为空。
- 在一个事务中将该 `SourceDocument` 及其直接产生的 `KnowledgeChunk.retrieval_status` 设回 `RETRIEVABLE`。
- 清空该来源 chunks 的 `withdrawn_at`、`withdrawn_by`、`withdrawal_reason`。
- 将历史引用中未解决的 `CitationAnnotation(annotation_type="source_withdrawn")` 标记为已解决（写入 `resolved_at`），但不得改写 Citation Snapshot。
- 写入 `AuditEvent(action="source_restored")`。

受限硬删除不属于默认管理动作，已拆到 `lib/knowledge/source-hard-delete.ts`：

- 校验 actor 必须为 `admin`。
- 必须显式传入 `confirm=true`。
- 硬删除原因不能为空。
- 删除前查询该 Source Document 产生的 `KnowledgeChunk.id`，若存在任何历史 `AnswerCitation` 引用则拒绝，错误码为 `source_has_historical_citations`。
- 通过前置条件后，在同一事务中先写入 `AuditEvent(action="hard_deleted")`，记录操作者、原因、来源旧状态与 chunk 数量；随后删除该来源产生的 chunks，并清理 Prisma-owned 手工 SQL 表中的依赖行（当前为 `ingest_tasks.document_id`），最后删除 `SourceDocument`。审计必须发生在破坏性删除之前，依赖行必须在 `source_documents` 删除之前清理，避免 `ON DELETE RESTRICT` 外键错误被折成 `unknown_domain_error`。

管理端文档生命周期 UI 已拆到 `app/docs/components/DocumentLifecycleActions.tsx`：

- 文档详情页展示撤出检索、恢复检索与受限硬删除入口。
- 撤出、恢复、硬删除都必须填写原因；硬删除额外要求勾选二次确认。
- 浏览器侧 POST/DELETE 调用与错误码映射由 `document-lifecycle-client.ts` 负责。
- 受限硬删除成功后，当前 `/docs/{docId}` 资源已不存在；UI 必须导航回文档列表（`/docs`）或其他稳定页面，不得仅刷新当前详情页并把预期 404 暴露给用户。
- UI 不直接调用 Prisma，也不绕过 `POST|DELETE /api/documents/[docId]` 与对应领域模块。
- 文档详情页的生命周期与 chunk readiness 展示由 `app/docs/components/document-review-presenter.ts` 投影。页面只消费 title、tone、action hint、readiness label/message，不在 JSX 中重复编码状态展示规则。

Source lifecycle live DB smoke 已落地为显式 opt-in 测试：

```powershell
cd caishui-webapp
$env:RUN_DB_SMOKE="true"
pnpm vitest run lib/knowledge/__tests__/source-lifecycle.db-smoke.test.ts
```

- 未设置 `RUN_DB_SMOKE=true` 或 `DATABASE_URL` 时，该测试默认跳过，不影响日常 `pnpm test`。
- 测试覆盖：撤出已被历史答案引用的来源、追加 `CitationAnnotation`、写入 `source_withdrawn` 审计、阻止硬删除；以及无历史引用来源可受限硬删除并保留 `hard_deleted` 审计。
- 测试会创建 disposable smoke rows，并在 `finally` 中清理。

### 5.7 Answer Read Model / History API（已落地）

`lib/knowledge/answer-read-model.ts` 是历史答案唯一只读投影：

- 读取 `COMPLETED` 且 `answer_text IS NOT NULL` 的答案，以及 `FAILED` 的检索准备失败答案。
- Citation 展示只使用不可变 `AnswerCitation.snapshot` 和后续 `CitationAnnotation`。
- 对 deterministic answer，读取 `coverage_evidence_snapshot.deterministicAnswerReason` 并投影到 `AnswerHistoryItem.deterministicReason`。
- 对 failed retrieval-readiness answer，投影 `errorCode`、`errorMessage`、`failedAt` 供审计；QA hydration 必须显示安全的 `retrieval_unavailable` 文案，不得把 provider 原始错误（如 401、timeout、stack）直接展示给普通用户。
- 普通 DeepSeek 答案该字段为 `undefined`。

### 5.8 Chat Client SSE Protocol（已落地）

浏览器侧 SSE 解析由 `app/qa/components/chat-sse-protocol.ts` 负责，`ChatWindow.tsx` 不再手写 `reader / TextDecoder / buffer / JSON.parse`。

协议模块要求：

- 支持一个网络 chunk 中包含多个 `data:` 事件。
- 支持一个 JSON payload 被拆成多个网络 chunk。
- 忽略 comment、空行和非 `data:` 行。
- 非法 JSON 抛 `ChatSseProtocolError`，由 UI 统一进入失败状态。

`app/qa/components/qa-client-session.ts` 负责浏览器侧会话编排：conversation id 持久化、历史 hydration、构造 `/api/chat` 请求、消费 `ChatStreamEvent`、维护 busy/ready 状态与最新 citations。`ChatWindow.tsx` 只负责渲染并调用该 Session Interface，不直接 fetch `/api/chat`、不直接消费 SSE、也不重写消息状态转换。`/api/chat` 必须先用运行时 schema 校验 `ChatRequest`，不得把 `await request.json()` 直接强转成内部类型。历史 hydration 只能在当前消息为空时替换消息列表，防止覆盖用户已开始的流式回答。

QA 页面消息状态投影由 `app/qa/components/qa-page-view-model.ts` 负责：包括追加 queued turn、生成最近 10 条对话历史、应用 `ChatStreamEvent`、以及 transport failure 的安全降级文案。UI 改版时 `ChatWindow.tsx` 只渲染，`qa-client-session.ts` 只编排，不得把这些状态转换重新散回 JSX。

`/api/chat` 请求中的历史上下文必须只包含稳定消息：用户消息和 `status="completed"` 的助手答案。失败审计记录、queued 占位、streaming 草稿、无状态 assistant 消息都不得进入 Standalone Query 或 Retrieval 上下文，避免把 UI 安全文案、半截生成内容或临时状态当成事实依据。

浏览器生成并持久化的 `conversationId` 仅用于 MVP/local 的会话连续性，不是授权凭证。当前历史读取路径尚未实现多用户/租户 ownership 校验；生产多用户上线前必须在服务端绑定 conversation ownership，并在 `/api/conversations/[conversationId]/answers` 等历史读取入口校验 actor 是否有权读取该会话。

用户可见的助手答案展示由 `app/qa/components/answer-display-presenter.ts` 负责：

- 历史 `FAILED` Answer 和流式 `error` 事件必须按错误码映射为安全文案，不得泄露 provider 原始错误、401、timeout 或 grounding 内部细节。
- `grounding_failed` 显示“答案生成后未通过引用一致性检查，已阻止展示”。
- `lib/knowledge/prompt-templates.ts` 必须明确要求每个事实性结论句末使用与参考资料编号一致的 `[n]` 引用标记；模型只写文号但不写 `[n]` 时，Finalization 仍应以 `grounding_failed` 拦截，不得自动放宽 Citation Grounding。该提示词硬化对应默认 `PROMPT_TEMPLATE_VERSION = "v1.1"`；后续如果提示词行为发生实质变化，必须同步递增默认版本并补测试，确保 Answer 审计可追溯。
- query embedding / retrieval readiness 失败显示“当前检索服务暂时不可用...”，并保持审计字段只在 read model / API 中存在。
- deterministic answer（`no_evidence` / `needs_clarification`）在历史 hydration 中追加简短提示，说明这是系统确定性回答，未调用生成模型。

### 5.9 WebApp → Pipeline 通信 Adapter（已落地）

WebApp 调用 data-pipeline 属于跨进程通信 seam。当前已落地：

- `lib/pipeline/trust-adapter.ts`：唯一 HMAC 签名实现，构造 `X-Pipeline-*` headers。
- `lib/pipeline/http-client.ts`：共享 transport seam，统一处理 `DATA_PIPELINE_URL`、HMAC 签名、`fetch`、HTTP status 与原始响应体解析；网络不可达等 `fetch` 异常统一映射为 `status: 0` + `network_error:*`，业务 client 不得重复拼装这些 transport 细节。
- `lib/pipeline/response.ts`：Pipeline HTTP 响应解析与错误格式化；非 JSON/plain-text 500 必须保留状态码与原文，避免再次出现 `Unexpected token ... Internal Server Error` 遮蔽根因。
- `lib/pipeline/ingest-client.ts`：`POST /ingest` 的 pipeline client，负责 FormData 构造和 accepted 响应校验。
- `lib/pipeline/accepted-task-readiness.ts`：`POST /ingest` 返回 accepted 后的 visibility check，确认 `/status/{task_id}` 能读到同一个 `task_id` 和 WebApp-owned `document_id`。live ingest 测试不得只把 `202 Accepted` 当作完整握手成功。
- `lib/pipeline/ingest-completion-readiness.ts`：accepted 后继续轮询 `/status/{task_id}`，直到 `SUCCESS` 才允许进入 reviewable chunks 读取；若 `FAILED`，必须将 pipeline `error_message` 带入 smoke trace，避免只看到 `task_failed` 而丢失真实原因。
- `lib/pipeline/status-client.ts`：`GET /status/{taskId}` 的 pipeline client，负责签名请求和状态透传。
- `app/api/pipeline/status/route.ts`：WebApp 状态查询 Adapter，负责把 `status-client` 的 transport `status: 0` 映射为 HTTP `502 + { error: "pipeline_unavailable", detail }`；不得将非法 HTTP status `0` 传给 `NextResponse`。
- `lib/pipeline/preview-client.ts`：`POST /preview` 的 pipeline client，负责 FormData 构造和 `PipelineOutput` 校验。
- `lib/pipeline/embedding-trigger.ts`：单个 verified chunk embedding job 的 pipeline client。
- `lib/pipeline/__tests__/live-handshake-fixture.ts`：live preview/ingest 握手测试夹具，集中维护 opt-in 环境开关、样例上传内容、lowercase pipeline wire `docType`、SHA-256 `fileHash`、admin actor，以及 `/ingest` 前置 SourceDocument 创建和清理。

后续新增或改造 pipeline 调用时，应继续把 URL 构造、签名、`fetch`、HTTP status 与原始响应体解析收敛到 `lib/pipeline/http-client.ts`；业务 pipeline client 只负责构造 endpoint-specific payload、校验 response shape、映射领域错误。Route handler 只负责 HTTP 入参/出参和调用 Adapter。

**API Route Boundary（已落地）**：

- Next.js App Router 的 `route.ts` 文件只能导出 HTTP handlers 与 Next 支持的 route config。不得为了单元测试从 `route.ts` 导出 parser、validator 或内部 helper；可测试逻辑应下沉到 `lib/*` owning Module，或通过 route public behavior 测试。
- 所有外部 query 参数必须在 route 边界归一化为有限安全值后再传给 DB query Module。文档列表分页采用默认 `page=1`、`pageSize=20`，`pageSize` 上限为 `100`；非法数字、负数、`NaN` 不得流入 `lib/db/queries/*`。

**Upload Source Document Module（已落地）**：

- `lib/knowledge/source-ingestion.ts` 负责 admin 授权、文件类型校验、同来源 hash 去重、创建 `PENDING` SourceDocument、写 `upload` AuditEvent，以及 pipeline 启动失败后的 `FAILED + ingest_failed` 补偿。
- `lib/knowledge/upload-validation.ts` 是 upload 与 preview 的共享文件输入边界：仅允许 MVP 支持的 `.pdf`、`.md`、`.txt`、`.csv`、`.xlsx`；拒绝空文件、超过 20MiB 的文件、空文件名、包含路径分隔符、`..` 或控制字符的危险文件名。该校验必须发生在 `arrayBuffer()`、创建 SourceDocument、保存 preview snapshot 或调用 data-pipeline 之前。
- 文件输入错误只能返回安全错误码（如 `unsupported_file_type`、`empty_file`、`file_too_large`、`invalid_file_name`），不得回显原始路径、原始文件名中的危险片段或内部异常。
- `app/api/upload/route.ts` 是薄 Adapter：解析 multipart request，调用 `source-ingestion.ts` 和 `ingest-client.ts`，并映射 HTTP 状态码。

**Upload Failure Visibility Module（已落地）**：

- Pipeline 启动失败时，`app/api/upload/route.ts` 必须先调用 `markSourceIngestionFailed(...)`，将 SourceDocument 置为 `FAILED` 并保存 `error_message`，然后在 `502` 响应中返回 `{ error: "pipeline_unavailable", sourceDocumentId }`。
- `502` 响应还必须包含 `detail`（原始 pipeline/transport failure 字符串），让上传页可即时显示真实失败原因；`app/admin/components/upload-response-presenter.ts` 负责将 `{ error, detail, sourceDocumentId }` 投影为管理员可见消息和失败文档链接。
- `app/admin/components/UploadForm.tsx` 在收到 `sourceDocumentId` 后展示“查看失败文档”入口，管理员可直接进入失败 SourceDocument 的详情页。
- `app/docs/components/DocTable.tsx` 在文档列表中展示 `FAILED` 文档的 `error_message`。
- `lib/knowledge/document-review-read-model.ts` 和 `app/docs/[docId]/page.tsx` 在文档详情页投影并展示同一失败原因。

**End-to-End Smoke Harness Module（已落地）**：

- `lib/smoke/e2e-smoke-harness.ts` 定义本地 E2E smoke 的编排契约，将 `upload source → ingest completion readiness → load reviewable chunks → human verify → trigger embedding → retrieval → answer` 串成可测试 trace。`retrieveForQuestion` 会收到本轮 `sourceDocumentId`、`taskId`、`verifiedChunkIds`，便于 live smoke 只引用本轮证据。
- `lib/smoke/e2e-smoke-adapters.ts` 将 Harness steps 映射到现有 WebApp public modules：`source-ingestion`、`ingest-client`、`ingest-completion-readiness`、`document-review-read-model`、`chunk-review`、`embedding-trigger`、`retriever`。最终 answer step 保持注入，避免 smoke 默认调用 live model。
- `lib/smoke/deterministic-smoke-retrieval.ts` 是 live smoke 专用检索替身：只返回本轮已经 human-verified 的 chunk IDs，不调用 query embedding provider，不搜索全库。它用于验证 WebApp ↔ Pipeline ↔ DB 链路，避免本地环境缺 `EMBEDDING_API_KEY` 时把供应商鉴权失败误判为集成失败。
- `lib/smoke/live-e2e-smoke-runner.ts` 是 opt-in live runner：要求 `RUN_E2E_SMOKE=true` 且配置 DB/data-pipeline/HMAC 环境变量，使用 deterministic retrieval + deterministic answer step，不调用 SiliconFlow 或 DeepSeek，并在运行后清理 smoke 创建的 SourceDocument、chunks 和 ingest task。清理完成后必须再次查询 `source_documents`、`knowledge_chunks`、`ingest_tasks` 的残留行数；若任一计数非零或 cleanup 抛错，runner 必须返回 `cleanup: { ok: false, reason, residualRows? }`，live test 优先报告 cleanup failure，避免 disposable rows 静默残留。
- `lib/smoke/live-e2e-smoke-preflight.ts` 是 live runner 的前置 readiness gate：先验证 opt-in 环境，再检查 data-pipeline `/health` 与 WebApp DB reachability。预检失败时不得创建 SourceDocument 或启动 `/ingest`。
- `lib/smoke/live-e2e-smoke-diagnostics.ts` 将 opt-in 环境缺失和 `{ ok: false, failedStep, reason, trace }` 结果格式化为开发者可读诊断文本。live smoke 测试失败时必须输出 failed step、reason、SourceDocument/task identity 与 trace，避免只暴露上层 Vitest 错误。
- `lib/smoke/live-e2e-smoke-runbook.ts` 与 `scripts/run-live-e2e-smoke.mjs` 提供稳定操作入口。推荐使用 `pnpm smoke:e2e:live` 执行 live E2E；脚本会设置 `RUN_E2E_SMOKE=true`，在缺少必要环境变量时打印 runbook 并拒绝静默 skip。CLI 入口必须在启动 live Vitest 前 preflight data-pipeline `/health` 与 `DATABASE_URL` TCP 可达性；data-pipeline 或 Postgres 未启动时输出 runbook 诊断，不暴露 Vitest/Prisma stack。
- `lib/smoke/provider-connectivity.ts` 与 `scripts/run-provider-smoke.mjs` 提供独立供应商连通性 smoke。推荐使用 `pnpm smoke:providers` 显式检查 SiliconFlow embedding 与 DeepSeek streaming：操作者只需提供 `EMBEDDING_API_KEY` 与 `DEEPSEEK_API_KEY`，CLI 会自动设置 `RUN_PROVIDER_SMOKE=true`。该 smoke 只验证 provider 鉴权与响应格式，不创建 SourceDocument/chunk/Answer，不访问 data-pipeline，也不替代 live E2E。
- `lib/smoke/provider-connectivity-diagnostics.ts` 将 provider smoke 的失败原因分类为 `auth_failed`、`network_timeout`、`embedding_shape_mismatch`、`stream_incomplete`、`missing_response` 或 `unknown`，并输出操作者动作建议。live provider smoke 失败时必须使用该格式化结果，而不是只抛出原始 `401`、timeout 或 stream parse error。
- `scripts/pnpm-spawn.mjs` 是 Node runbook CLI 的 pnpm 子进程启动 helper。`run-provider-smoke.mjs`、`run-live-e2e-smoke.mjs`、`run-release-readiness.mjs` 必须通过它启动 Vitest；Windows 下 helper 使用 `cmd.exe /d /s /c pnpm ...` + `shell=false`，避免 `shell:true` 参数拼接触发 Node `DEP0190` 安全警告并污染验收输出。
- `lib/smoke/migration-readiness-runbook.ts` 固化 Prisma 迁移验收说明：先跑 offline `pnpm vitest run prisma/__tests__/migration-contract.test.ts`，确认初始迁移仍折叠 pgvector、HNSW、`ingest_tasks` 和手工 invariant；再在配置 `DATABASE_URL` / `SHADOW_DATABASE_URL` 后执行 live `pnpm prisma migrate status`、`pnpm prisma migrate diff ... --shadow-database-url $env:SHADOW_DATABASE_URL`、`pnpm prisma migrate deploy`。该 Runbook 只描述 Prisma-owned DDL，不得引入 Alembic 或 Python `create_all`。
- `lib/pipeline/contract-parity.ts` 是离线跨引擎 JSON contract parity guard：读取 `caishui-webapp/types/pipeline.ts` 与 `data-pipeline/output/schemas.py`，校验 `DocType`、`ChunkType` 的闭合枚举值，以及 `TaxMetadata`、`ChunkOutput`、`PipelineOutput` 字段集合。它用于捕获 `publish_date`、`source_channel`、大小写 wire value 等跨引擎漂移。
- `lib/smoke/final-acceptance-runbook.ts` 固化最终本地验收顺序：`pnpm vitest run prisma/__tests__/migration-contract.test.ts` → `pnpm vitest run lib/pipeline/__tests__/contract-parity.test.ts` → `pnpm typecheck` → `pnpm test` → `$env:NEXT_DISABLE_STANDALONE="true"; pnpm build` → `pnpm release:readiness` → `pnpm smoke:e2e:live` → `pnpm smoke:providers`。该模块同时负责 execution planning：根据当前环境投影 runnable steps 与 env-blocked steps，避免手工判断遗漏。`scripts/print-final-acceptance-plan.mjs` 是薄 CLI 入口，`pnpm acceptance:plan` 只打印计划、不执行验收命令。provider smoke 只验证供应商鉴权与响应形状，不能替代 live E2E；Windows 本地 build 使用禁用 standalone 的命令仅用于本机校验，部署构建仍保留默认 standalone 输出。运行本地 build 前必须停止 `next dev` 并删除 `.next`，避免 dev/build 共用缓存导致 route collection 出现 stale `PageNotFoundError`。
- Runbook `.mjs` CLI 会直接从 Node 导入部分 `.ts` runbook 模块，因此这些 runbook 模块的内部共享 helper 必须使用 Node 可解析的相对 runtime import。不得在该路径使用 `@/` alias 或 extensionless TS-only helper import。当前共享格式化 helper 固化为 `lib/smoke/runbook-format.js` + `runbook-format.d.ts`，用于兼顾直接 Node CLI 与 TypeScript typecheck。
- `lib/knowledge/release-readiness.ts` 与 `scripts/run-release-readiness.mjs` 提供上线前数据库闸门。推荐使用 `pnpm release:readiness` 检查 MVP forbidden states：不得存在 `verification_method='auto'` 的 chunk、不得存在 `verification_status='disputed'` 的 chunk、不得存在缺少 `failed_at` / `error_code` / `error_message` 的 `FAILED` Answer。该命令需要 `DATABASE_URL`，失败时输出 blocker count 与修复 Action。
- Harness 本身不直接依赖 live DB、data-pipeline、Embedding API 或 DeepSeek；这些能力通过 injectable steps 提供。这样离线测试可稳定验证编排语义，live smoke 后续只需替换 step adapter。
- 任一关键步骤失败或抛出异常时，Harness 必须停止后续步骤，并返回 `{ ok: false, failedStep, reason, trace }`。如果失败发生在 upload 之后，结果中必须保留 `sourceDocumentId` / `taskId`，以便 live runner 清理 disposable smoke rows，避免把前置失败误判为检索或问答失败。

**Preview Persistence Module（已落地）**：

- `app/api/pipeline/preview/route.ts` 是薄 Adapter：admin 权限校验、解析 multipart request、调用 `preview-client.ts`，然后调用 `preview-persistence.ts` 保存 snapshot。
- Preview route 与正式 upload route 使用同一个 `upload-validation.ts` 边界。Preview 虽不创建 SourceDocument、不验证 chunk、不生成 embedding，也必须在读取文件 bytes 或调用 `preview-client.ts` 前拒绝不支持的扩展名、空文件、超大文件和危险文件名，避免 preview 成为绕过 upload 约束的入口。
- `app/admin/components/pipeline-status-presenter.ts` 是后台任务状态的 UI projection：将正常任务 payload 投影为进度展示，将 `{ error, detail }` 投影为管理员可见错误，避免 `PipelineStatus.tsx` 在 pipeline 不可达时显示 `undefined` 状态。
- `lib/knowledge/document-review-read-model.ts` 负责文档生命周期与 chunk retrieval-readiness projection：文档详情页必须消费 `document.lifecycle` 来展示检索状态摘要、ready/blocked/unverified 计数，以及撤出/恢复按钮可用性，不得在 JSX 中重新推导这些规则。该 Module 的 Interface 支持 `chunkPage` / `chunkPageSize`，文档详情页不得一次性读取大型文档的全部 chunks。只有 `verification_status='verified' + embedding_status='COMPLETED' + retrieval_status='RETRIEVABLE'` 的 chunk 才显示为 ready；已核验但 embedding 未完成的 retrievable chunk 必须在文档详情页显示“默认检索不会召回”的 warning，并设置 `canRetryEmbedding=true`。已撤出检索的 chunk 必须说明 withdrawn 原因，且不得显示 retry embedding 动作。
- `lib/knowledge/preview-persistence.ts` 暴露 `PreviewSnapshotStore`、`savePreviewSnapshot(...)` / `loadPreviewSnapshot(...)`。MVP 默认使用本地文件 snapshot 存储，目录为 `PREVIEW_SNAPSHOT_DIR` 或 `.preview-snapshots/`，TTL 为 24 小时；读写时必须复制 snapshot，过期读取会清理文件。该 Module 的 Interface 隐藏存储实现，未来可替换为 DB Adapter。
- 前端上传页通过“预览分块”按钮先调用 `/api/pipeline/preview`，展示 `previewId` 和 `ChunkPreview`；该动作不创建 SourceDocument、不验证、不生成 embedding、不进入检索。

**错误模式要求**：

- 权限错误（`forbidden_requires_role:*`）统一映射为 HTTP `403`。
- `lib/knowledge/domain-error.ts` 是领域错误解析、HTTP 状态映射和生命周期错误展示标签的唯一归口。
- `lib/knowledge/admin-action-adapter.ts` 是管理类 API route 的薄 Adapter helper：负责 actor 解析、安全 JSON body 读取和结构化 domain error response。Route 不应重复解析 `X-User-*` 头或用字符串匹配 thrown error。
- Pipeline transport failure 不得自动回滚已提交的领域状态，除非 owning Module 明确要求原子性。
- 日志和注释必须标明真实 provider / Module：Chat 是 DeepSeek，Embedding 是 SiliconFlow/Embedding API。

**Data Pipeline Final Acceptance（已落地）**：

- `data-pipeline/acceptance_runbook.py` 固化 pipeline 侧最终本地验收顺序，并提供 CLI：`.\.venv\Scripts\python -m acceptance_runbook`。验收顺序为 `.\.venv\Scripts\python -m pip install -r requirements.txt` → `.\.venv\Scripts\python -m pytest` → `.\.venv\Scripts\python -m uvicorn api.main:app --host 127.0.0.1 --port 8000` → `GET http://127.0.0.1:8000/health`。
- 该 Runbook 明确要求从 `data-pipeline/` 目录运行，并使用项目 `.venv`；不得使用 global Anaconda、系统 `python` 或裸 `pytest`。
- Windows 下必须设置 `PYTHONUTF8=1`；启动服务时必须配置 async SQLAlchemy 形式的 `DATABASE_URL`（如 `postgresql+asyncpg://...`）和与 WebApp 一致的 `PIPELINE_SHARED_SECRET`。
- Pipeline 不拥有数据库迁移；最终验收也不得引入 Alembic 或 SQLAlchemy `create_all`。
- `tests/test_acceptance_runbook_parity.py` 负责防止 Pipeline runbook、`README.md`、`pyproject.toml` 和 `requirements.txt` 漂移：README 必须包含 runbook 的命令与警告，`pyproject.toml` 必须保留 `pythonpath = ["."]` 与 `asyncio_mode = "auto"`，`requirements.txt` 必须保留 `openai==1.35.13` / `httpx==0.27.2` 兼容锁。

---

## 六、关键 ADR 落地检查

| ADR                                 | 文档体现                                                     | 代码/配置体现                                                         |
| ----------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------- |
| 0001 源文档 ≠ 法律权威                     | 模型 `SourceDocument`，无独立 `TaxAuthorityDocument`           | `schema.prisma` 已重命名                                            |
| 0002 检索未命中不断言“不存在”                  | Deterministic Answer + Evidence Policy                         | `chat-turn.ts` 中 `NO_EVIDENCE` 不调用模型，持久化确定性答案             |
| 0003 引用快照不可变                        | `AnswerCitation.snapshot` Json，`CitationAnnotation` 增量   | `answer.ts` 提交快照；`source-withdrawal.ts` 只追加注解不改写快照        |
| 0004 有效适用性分层                        | 5.1 区分法律门控与操作门控；时间维度经 `buildTemporalFilter` 注入；管辖地不入 SQL | `LEGAL_GATES`（版本+核验）与 `OPERATIONAL_GATES` 分离，`extraFilter` 传时间维度 |
| 0005 身份信任 opt‑in + 角色独立             | 权限与审计章节，`TRUST_PROXY_AUTH` 默认 false；开启时必须校验 `PROXY_SHARED_SECRET`；`admin` ≠ `reviewer` | `actor.ts`（默认拒信任 + 代理密钥校验 + 分角色 `requireRole`）                          |
| 0006 Embedding = SiliconFlow 1024 维 | 技术栈锁定，Schema `vector(1024)`                              | `embedder.py` 调用 SiliconFlow；`embedding_lifecycle.py` 管理 1024 维向量生命周期；`embedding_job.py` 复用同一生命周期 |
| 0007 Prisma 唯一 DDL + drift 检查       | 附录及 ADR‑0007                                             | `db/schema_check.py` 启动时对比 `ingest_tasks`                       |
| 0008 常驻进程 + 任务回收 + 禁用 Serverless    | `DEPLOYMENT.md`，启动回收逻辑                                   | `recovery.py`，`instrumentation.ts` 检测 Serverless 环境             |
| 0009 Pipeline 服务信任边界              | WebApp → Pipeline 通信 Adapter，HMAC 签名                         | `trust-adapter.ts` 签名；`pipeline_trust.py` 验签；`embedding-trigger.ts` 调用 `/chunks/{id}/embed` |

---

## 七、启动防护与任务回收（新增）

### 7.1 Serverless 防护（`caishui-webapp/instrumentation.ts`）

```typescript
// 仅在 Node 服务端校验；检测到已知 Serverless 运行时则抛错拒绝启动（见 ADR-0008）。
// 注意：不要把 NEXT_PHASE==='phase-production-build' 当作信号——那会误杀 `next build`。
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.ALLOW_SERVERLESS === 'true') return;

  const signals: Array<[string, string | undefined]> = [
    ['AWS_LAMBDA_RUNTIME_API', process.env.AWS_LAMBDA_RUNTIME_API],
    ['AWS_LAMBDA_FUNCTION_NAME', process.env.AWS_LAMBDA_FUNCTION_NAME],
    ['VERCEL', process.env.VERCEL],
    ['FC_FUNCTION_NAME', process.env.FC_FUNCTION_NAME],   // 阿里云 FC
    ['SCF_FUNCTIONNAME', process.env.SCF_FUNCTIONNAME],   // 腾讯云 SCF
  ];
  const detected = signals.filter(([, v]) => v).map(([k]) => k);
  if (detected.length > 0) {
    throw new Error(
      `Refusing to start: serverless runtime detected (${detected.join(', ')}). ` +
        `Deploy on a long-running container (ADR-0008). Set ALLOW_SERVERLESS=true to override.`,
    );
  }
}
```

### 7.2 启动时回收孤儿任务（`data-pipeline/db/recovery.py`）

单进程/单副本：进程重启后，启动时所有非终态任务都必然是上一进程遗留的孤儿——
**无需时间阈值**，直接标记 FAILED（见 ADR-0008）。注意列名为 `completed_at`（非 `finished_at`）。

```python
async def reclaim_orphaned_tasks(engine) -> int:
    async with engine.begin() as conn:
        result = await conn.execute(
            text("""
                UPDATE ingest_tasks
                SET status = 'FAILED',
                    error_message = 'orphaned task reclaimed after pipeline restart',
                    completed_at = NOW(),
                    updated_at = NOW()
                WHERE status IN ('PENDING', 'PROCESSING')
                RETURNING document_id
            """)
        )
        document_ids = [row[0] for row in result.all()]
        if document_ids:
            await conn.execute(
                text("""
                    UPDATE source_documents
                    SET processing_status = 'FAILED',
                        error_message = 'orphaned task reclaimed after pipeline restart',
                        updated_at = NOW()
                    WHERE id = ANY(:ids)
                      AND processing_status IN ('PENDING', 'PROCESSING')
                """),
                {"ids": document_ids},
            )
        return len(document_ids)
```

在 FastAPI `lifespan` 中调用（先 schema 检查，再回收）：

```python
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    await check_ingest_tasks_schema(engine)   # 先校验 schema 一致性（ADR-0007）
    await reclaim_orphaned_tasks(engine)      # 再回收孤儿任务（ADR-0008）
    yield

app = FastAPI(lifespan=lifespan)
```

---

## 八、文档一致性说明

本 v2.1 文档已完全移除以下过时表述：

- ❌ `deepseek-embedding` 模型及 1536 维
- ❌ 任何“文档级验证”暗示（如 `Document.verification_status`）
- ❌ Serverless 部署推荐（改为禁止 + 防护）
- ❌ `prisma.$raw` 等错误 API 示例

所有代码示例均与 ADR 保持一致。`CONTEXT.md` 和 `docs/adr/` 中的术语与决策已同步。

### 8.1 Code Review Execution Strategy（已校准）

`docs/CODE_REVIEW_EXECUTION_STRATEGY.md` 是代码审查修补的执行模板，不是新的架构来源。执行扫描建议前必须先用本架构文档、根 `AGENTS.md` 和最近的 Module-local `AGENTS.md` 过滤：

- 不得为了测试从 Next.js App Router `route.ts` 导出非 Next 支持的 helper。
- 不得通过 `STRICT_UPLOAD_MODE=false` 或类似环境变量关闭后端 upload/preview 安全校验。
- 不得把允许上传的扩展名默认交给环境变量随意放宽；若未来需要可配置化，必须形成单独 ADR。
- 不得把 runbook helper 重构为 Node `.mjs` CLI 无法直接解析的 `@/` alias 或 extensionless TS-only import。
- 纯文档/注释变更不伪造 RED/GREEN；行为变更仍必须按 TDD 垂直切片执行。

原始外部扫描执行建议保存在 `docs/CODE_REVIEW_EXECUTION_STRATEGY.md.backup`，用于追溯；当前主文件保留已校准后的可执行策略。

---

## 九、后续步骤

1. 按 `lib/smoke/final-acceptance-runbook.ts` 固化的顺序执行 WebApp 最终本地验收：`pnpm vitest run prisma/__tests__/migration-contract.test.ts`、`pnpm vitest run lib/pipeline/__tests__/contract-parity.test.ts`、`pnpm typecheck`、`pnpm test`、`$env:NEXT_DISABLE_STANDALONE="true"; pnpm build`、`pnpm release:readiness`、`pnpm smoke:e2e:live`、`pnpm smoke:providers`。其中 `pnpm release:readiness` 在运行 live DB 断言前必须 preflight `DATABASE_URL` 的 TCP 可达性；数据库未启动时输出 runbook 诊断，不暴露 Prisma stack。
2. 执行一次 provider connectivity smoke：`pnpm smoke:providers`。该入口要求操作者提供 `EMBEDDING_API_KEY` 与 `DEEPSEEK_API_KEY`，并由脚本自动设置 `RUN_PROVIDER_SMOKE=true`；它会检查 SiliconFlow `/v1/embeddings` 返回 `BAAI/bge-large-zh-v1.5` 的 1024 维向量，并检查 DeepSeek streaming 返回合法 SSE + `[DONE]`。失败输出必须包含 classification 与 Action，例如 `auth_failed` 提示检查对应 API key / quota，`embedding_shape_mismatch` 提示检查模型与 1024 维约束，`stream_incomplete` 提示 DeepSeek stream 未收到 `[DONE]`。
3. 按 `data-pipeline/acceptance_runbook.py` 固化的顺序执行 Pipeline 最终本地验收：安装锁定依赖、运行 `.venv` 下的 pytest、启动 uvicorn、检查 `/health`。
4. 启动 Docker Desktop / Docker daemon 后运行 Postgres(pgvector)，并执行 `pnpm prisma migrate deploy` 应用 `20260612141000_init` 初始迁移。若本机 `5432` 已被其他项目占用，设置 `POSTGRES_PORT=55432` 并在 `DATABASE_URL` 中使用 `127.0.0.1:55432`。
5. 运行 `RUN_DB_SMOKE=true` 的 Source lifecycle DB smoke，验证撤出、引用注解、硬删除前置条件与审计写入。本地已验证该 smoke 在 `127.0.0.1:55432` 通过。
6. 执行 release readiness DB gate：`pnpm release:readiness`。该入口要求 `DATABASE_URL`，会阻断 `verification_method='auto'`、`verification_status='disputed'`、以及缺少失败审计字段的 `FAILED` Answer。
7. 启动 `data-pipeline`，观察 `schema_check.py` 与 `recovery.py` 日志通过。
8. 启动 `caishui-webapp`，验证 `instrumentation.ts` 在 Serverless 环境下正确拦截（或通过 `ALLOW_SERVERLESS=true` 绕过测试）。
9. 执行 live E2E：优先运行 `pnpm smoke:e2e:live`。该入口会先检查必要环境变量，再由 preflight 检查 data-pipeline `/health` 与 DB reachability，然后执行上传 seed 文档 → pipeline 生成 chunks → human verify → trigger embedding job → deterministic smoke retrieval → deterministic answer step → cleanup verification。该 smoke 不调用 DeepSeek 或 SiliconFlow；供应商连通性测试应单独作为显式 opt-in provider smoke。

纯逻辑深模块已经基本落地；下一阶段重点是 live DB/API 联调、迁移验证和端到端可信闭环。

---

*文档版本：v2.1 | 更新时间：2026-06-15*  
*核心变更：SiliconFlow bge-large-zh-v1.5 (1024维)；SourceDocument 重命名；chunk 级验证；Prisma Initial Migration；Upload Source Document Module；Upload/Preview Input Boundary Validation；File-backed Preview Persistence Module；Chat Turn Orchestration；QA Client Session；Answer/Citation 审计链；Retrieval Failure Answer 审计；Domain Error / Admin Action Adapter；Source Withdrawal / Hard Delete Preconditions + audit-before-delete；Embedding Lifecycle；Verified Chunk Embedding Trigger / Job；WebApp → Pipeline HMAC/HTTP Transport/Ingest/Status/Preview Adapter；WebApp/Pipeline Contract Parity Guard；Live E2E Smoke Harness + Deterministic Smoke Retrieval + Cleanup Verification；Provider Connectivity Smoke；Migration Readiness Runbook；Release Readiness Guardrails；WebApp/Pipeline Final Acceptance Runbooks；Runbook CLI Import Boundary；Pipeline Runbook Parity Guard；Client SSE Protocol；任务回收；Serverless 防护。*
