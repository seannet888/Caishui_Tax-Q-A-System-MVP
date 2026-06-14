# 代码审查标准与流程

> 适用项目：财税知识库问答 WebApp（MVP）  
> 引擎：`caishui-webapp/`（Next.js 14.2 + TypeScript strict + Prisma）+ `data-pipeline/`（Python 3.11 + FastAPI + Pydantic v2）  
> 最后更新：2026-06-14

---

## 一、核心原则

本系统的**定义性约束**是政策时效正确性：向用户返回一条已废止的法规、过期税率，或无证据支撑的"未出台"断言，是比 UI Bug 严重得多的正确性缺陷，可能直接导致错误申报和法律风险。

代码审查的首要目标是**保护这条核心约束**，其次才是常规工程质量。

**优先级框架**：
- 🔴 **Blocker**：必须修复，阻止合并
- 🟡 **Suggestion**：强烈建议修复，可在后续 PR 修复但需标注 issue
- 💭 **Nit**：可选，不影响合并

---

## 二、审查流程

### 2.1 提交前（Author 自检）

提交 PR 前，Author 必须本地通过：

```powershell
# WebApp 引擎
cd caishui-webapp
pnpm typecheck
pnpm test                                        # vitest run --pool=forks
pnpm vitest run lib/pipeline/__tests__/contract-parity.test.ts

# Pipeline 引擎
cd data-pipeline
$env:PYTHONUTF8="1"
.\.venv\Scripts\python -m pytest
```

**跨引擎合约变更**额外要求：若修改了 `types/pipeline.ts` 或 `output/schemas.py`，必须同时更新另一侧并在 PR 描述中明确说明镜像修改范围。

### 2.2 PR 描述模板

```markdown
## 变更类型
- [ ] 新功能  - [ ] Bug修复  - [ ] 重构  - [ ] 跨引擎合约变更  - [ ] Schema 迁移

## 变更描述
<!-- 一句话：做了什么，为什么 -->

## 受影响的模块
<!-- 列出修改的 Module，对照 AGENTS.md 中的模块映射表 -->

## 自检清单
- [ ] `pnpm typecheck` 通过
- [ ] `pnpm test` 通过（vitest run --pool=forks）
- [ ] 若改动合约：`contract-parity.test.ts` 通过
- [ ] 若改动 Schema：新增 Prisma migration，未动 Alembic
- [ ] 生成文件已清理（.next / __pycache__ / .pytest_cache）
```

### 2.3 Reviewer 审查顺序

1. **先跑自动检查**（CI / 本地验证）— 测试红则不进入人工审查
2. **逐项过 Blocker 清单**（见第三章）— 有 🔴 则拒绝合并，要求修复后重审
3. **领域深度审查**（见第四章）— 按受影响模块对照检查
4. **提交结构化反馈**（见第五章格式）

### 2.4 审查时限

| 变更规模 | 期望反馈时限 |
|---------|------------|
| < 100 行改动 | 1 个工作日 |
| 100–500 行 | 2 个工作日 |
| > 500 行 / 跨引擎 | 3 个工作日，建议拆小 PR |
| 紧急 hotfix | 4 小时内（Blocker 检查不可跳过） |

---

## 三、Blocker 清单（🔴 必须修复）

以下任一问题均阻止合并，不讨价还价。

### B1：服务端/客户端边界

```
检查点：Prisma 只能出现在以下位置
  ✅ Server Components
  ✅ app/api/**/route.ts
  ✅ Server Actions
  ✅ lib/db/**
  ✅ server-only 模块

  ❌ 'use client' 组件
  ❌ hooks（useXxx）
  ❌ lib/utils/ 等通用工具
  ❌ types/ 目录
```

**为什么**：Prisma Client 包含 Node.js 原生模块，在浏览器环境会打包失败；更重要的是泄露数据库连接细节到客户端包。

**发现方式**：
```bash
grep -rn "from '@prisma/client'" caishui-webapp/app --include="*.tsx" --include="*.ts"
# 检查有 'use client' 的文件是否在结果中
```

---

### B2：检索层隔离

```
检查点：所有问答逻辑只能经过 lib/knowledge/

  ❌ app/api/chat/route.ts 中直接拼 Prompt 调 DeepSeek
  ❌ UI 组件直接 fetch DeepSeek / Embedding API
  ❌ lib/db/ 查询函数中包含业务逻辑
  ❌ API Route 直接组装 retrieval filter
  ❌ route 中出现 LEGAL_GATES / OPERATIONAL_GATES 等检索常量
```

**为什么**：检索层的时效门控是本系统核心护栏。一旦绕过，就可能返回已废止政策给用户，且没有任何测试能捕获到。`app/api/chat/route.ts` 必须是薄 SSE Adapter，不含检索编排。

---

### B3：JSON 合约一致性

```
检查点：types/pipeline.ts 与 data-pipeline/output/schemas.py 必须结构镜像

  ❌ 使用 as 断言掩盖类型不兼容（TypeScript 侧）
  ❌ 使用 Partial<PipelineOutput> 绕过字段校验
  ❌ 使用 Any / dict / str 掩盖 Pydantic 字段（Python 侧）
  ❌ 枚举值大小写不一致（如 TS 用 "PDF" 而 Python 用 "pdf"）
  ❌ 新增字段只改一侧
```

**为什么**：两引擎通过 JSON 契约通信，类型漂移会导致运行时解析失败，且可能在 CI 通过后才在生产暴露。`DocType`、`ChunkType`、`TaxMetadata`、`ChunkOutput`、`PipelineOutput` 的字段集合必须完全对齐。

**验证命令**：
```bash
cd caishui-webapp
pnpm vitest run lib/pipeline/__tests__/contract-parity.test.ts
```

---

### B4：DDL 唯一所有者

```
检查点：只有 Prisma 拥有 DDL

  ❌ data-pipeline 中引入 Alembic
  ❌ Python 中调用 SQLAlchemy create_all() 或 metadata.create_all()
  ❌ data-pipeline 中直接执行 CREATE TABLE / ALTER TABLE SQL
  ❌ 新增表/字段未经过 Prisma migration
```

**为什么**：双重迁移来源会导致 schema drift，尤其是 `ingest_tasks` 表，既需要 Python 写入又需要 Prisma 读取，稍有不一致就会产生难以复现的运行时错误。

---

### B5：有效适用性门控不可绕过

```
检查点：默认检索必须经过完整门控

  ❌ 绕过 verification_status = 'verified' 检查（以提高召回率为由）
  ❌ 绕过 embedding_status = 'COMPLETED' 检查
  ❌ 绕过 retrieval_status = 'RETRIEVABLE' 检查（document 或 chunk）
  ❌ 绕过 is_current_version = true 检查
  ❌ 时间过滤使用字符串拼接而非 Prisma.Sql 参数化绑定
```

**为什么**：这是时效正确性的最后防线。绕过任何一项，就可能把未核验的、已废止的或已撤出的内容作为答案证据返回给用户。

**特别注意**：
```typescript
// ❌ 危险：字符串拼接 Raw SQL
const expireFilter = `AND kc.expire_date > '${queryDate}'`

// ✅ 正确：Prisma.Sql 参数化
const expireFilter = queryDate
  ? Prisma.sql`AND (kc.expire_date IS NULL OR kc.expire_date > ${queryDate})`
  : Prisma.empty
```

---

### B6：Distance 与 Similarity 不可混淆

```
检查点：向量检索的距离与相似度语义

  ❌ 把余弦距离（<=> 结果）当相似度使用
  ❌ 用 distance DESC 排序（应为 distance ASC）
  ❌ 用 distance 做证据充分性判断（应用 similarity = 1 - distance）
  ❌ Prisma findMany 获取 embedding 字段值（Unsupported 类型，恒为 null）
```

**为什么**：`<=>` 返回余弦距离（值越小越相似），distance=0.1 对应 similarity=0.9，混淆后排序和阈值判断会完全反转，静默地把最不相关的内容排在最前面。

---

## 四、领域级深度审查

### 4.1 Python 数据管线（data-pipeline/）

**Embedding 生命周期**

- [ ] 只有 `verification_status == "verified"` 的 chunk 才调用 Embedding API
- [ ] `rejected` chunk 的 `embedding` 字段必须为 `null`，`verification_notes` 必须非空
- [ ] Embedding 失败不得修改 `verification_status`
- [ ] 自动重试最多 3 次，达到上限设 `embedding_status = "FAILED"` + `embedding_error = "automatic_retry_limit_reached"`
- [ ] `embedding_identity = SHA256(document_id + content_hash + model + dimension)`，幂等去重

**Embedder**

- [ ] 使用 `openai==1.35.13` + `httpx==0.27.2` 固定版本
- [ ] 不调用 DeepSeek 的 embedding 接口（两个 Provider 独立，`EMBEDDING_API_KEY` ≠ `DEEPSEEK_API_KEY`）
- [ ] 向量维度断言：`len(vector) != 1024` 时必须抛出 `ValueError("embedding_dimension_mismatch")`

**分块器**

- [ ] 表格必须整体保留，不在表格中间切分
- [ ] 超长 chunk（> 1024 tokens）须在语义边界切分，不能机械截断
- [ ] `chunk_index` 与 `pipeline_chunk_id = SHA256(file_hash + chunk_index)` 需正确绑定

**元数据抽取**

- [ ] 只使用纯正则，MVP 阶段不调用 LLM 做元数据抽取
- [ ] `authority_rank` 无法判定时留 `null`，不猜测
- [ ] `publish_date` 须用正则从页面元数据或标题/落款抽取，不可硬编码

**启动行为**

- [ ] `lifespan` 中必须先调用 `check_ingest_tasks_schema`，再调用 `reclaim_orphaned_tasks`
- [ ] 孤儿任务回收（status IN ('PENDING', 'PROCESSING')）直接设 `FAILED`，无需时间阈值

---

### 4.2 WebApp 检索与问答（lib/knowledge/）

**Chat Turn 编排**

- [ ] `app/api/chat/route.ts` 必须是薄 SSE Adapter，不含检索编排
- [ ] 检索 provider 失败（embedding API 错误）必须走 `retrieval-failure-answer.ts` 路径，持久化 `FAILED` Answer，不得降级为 `no_evidence`
- [ ] 零召回（检索成功但无结果）走 `no_evidence` 确定性答案，不调用 DeepSeek

**Answer 状态机**

```
允许的状态流转：
  GENERATING → COMPLETED（收到 [DONE] + grounding 通过 + 原子事务提交）
  GENERATING → FAILED  （模型失败 / grounding_failed / client_disconnected）

  ❌ 不允许：FAILED → COMPLETED（必须新建 Answer 记录重试）
  ❌ 不允许：已收到 [DONE] 并进入最终事务后，客户端断开取消提交
```

**Citation Grounding Check**

- [ ] `[n]` 引用编号合法且不越界
- [ ] 答案中出现的文号必须存在于某条 Citation Snapshot 的 `docNumber`
- [ ] Grounding 失败：Answer 转 FAILED，`error_code = grounding_failed`，前端只显示重试提示

**Citation Snapshot**

- [ ] `chunkId` 必须是 `KnowledgeChunk.id`（CUID），不是 pipeline 的 SHA-256 `pipeline_chunk_id`
- [ ] `content_hash` 必须是 64 位 hex（SHA-256）
- [ ] 证据片段不超过 2000 字符，超限在语义边界截断并置 `isTruncated: true`
- [ ] Citation Snapshot 一经写入不可修改（来源撤出只追加 `CitationAnnotation`）

**Deterministic Answer 审计**

- [ ] `no_evidence` 和 `needs_clarification` 答案也必须写入 Answer 审计链
- [ ] `model = "deterministic-template"`
- [ ] `coverage_evidence_snapshot.deterministicAnswerReason` 仅允许 `"needs_clarification"` 或 `"no_evidence"`

---

### 4.3 WebApp → Pipeline 通信（lib/pipeline/）

- [ ] 所有 Pipeline HTTP 调用必须经过 `lib/pipeline/http-client.ts`（URL 构造 + HMAC 签名 + fetch + 错误映射）
- [ ] 业务 client（ingest/status/preview/embedding-trigger）只负责 endpoint-specific payload 和 response shape
- [ ] Route handler 只负责 HTTP 入参/出参，不拼装 HMAC headers
- [ ] `transport status: 0` 必须映射为 HTTP `502 + { error: "pipeline_unavailable" }`，不得传给 `NextResponse`
- [ ] Pipeline 启动失败后必须先调用 `markSourceIngestionFailed`，再返回 502

---

### 4.4 来源生命周期与权限（lib/knowledge/）

**撤出/恢复**

- [ ] 撤出和恢复都必须校验 actor 为 `admin`，原因非空
- [ ] 事务内同时更新 `SourceDocument.retrieval_status` + 关联 `KnowledgeChunk.retrieval_status`
- [ ] 撤出后追加 `CitationAnnotation(annotation_type="source_withdrawn")`，不改写 Citation Snapshot
- [ ] 恢复后将未解决的 `source_withdrawn` 注解标记 `resolved_at`，同样不改写 Citation Snapshot

**硬删除**

- [ ] 必须校验 `confirm: true`，原因非空
- [ ] 有历史 `AnswerCitation` 引用时必须拒绝，错误码 `source_has_historical_citations`
- [ ] 通过前置条件后，同事务删除 chunks + SourceDocument，写 `AuditEvent(action="hard_deleted")`

**审计**

- [ ] 业务状态更新与 AuditEvent 必须在同一数据库事务中提交
- [ ] AuditEvent 载荷不含完整 Prompt 或 API Key

---

### 4.5 前端 UI（app/ 组件层）

**服务端/客户端边界**（再次强调）

- [ ] 有 `'use client'` 指令的文件不得 import Prisma 或任何 `lib/knowledge/` 的服务端模块
- [ ] `lib/db/` 查询函数不含 `'use client'` 指令

**SSE 协议**

- [ ] 浏览器侧 SSE 解析必须经过 `chat-sse-protocol.ts`，`ChatWindow.tsx` 不得手写 reader/TextDecoder/buffer
- [ ] 支持单个网络 chunk 含多个 `data:` 事件，支持 JSON payload 被拆成多个 chunk
- [ ] 历史 hydration 只在当前消息为空时替换消息列表

**错误码映射**

- [ ] provider 原始错误（401、timeout、stack trace）不得直接展示给普通用户
- [ ] `grounding_failed` → "答案生成后未通过引用一致性检查，已阻止展示"
- [ ] `retrieval_unavailable` → "当前检索服务暂时不可用..."

---

## 五、反馈格式规范

### 标准评论格式

```
🔴 **[分类]：[标题]**
位置：[文件名:行号 或 模块名]

**问题**：[具体描述问题，引用相关代码片段]

**为什么**：[解释危害，关联架构约束或 ADR]

**建议**：
[修复方向或代码示例]
```

### 示例（Blocker）

```
🔴 **检索层隔离：Prompt 拼装泄漏到 Route**
位置：app/api/chat/route.ts:42

**问题**：当前 route 直接调用了 `buildTaxPrompt(chunks)` 并拼接了 evidence policy 逻辑，
应当调用 `planChatTurn()` 并让 `lib/knowledge/chat-turn.ts` 统一编排。

**为什么**：这违反了检索层隔离（B2），一旦时效门控逻辑散落到 route，
就无法保证 `LEGAL_GATES` + `OPERATIONAL_GATES` 始终生效（关联 ADR-0004）。

**建议**：
route 只调用 `planChatTurn()`，由其返回 `{ kind: "generate", generationInput }`，
再调用 `generateAnswerEvents(generationInput, ...)` 完成流式生成。
```

### 示例（Suggestion）

```
🟡 **缺少 distance/similarity 语义断言**
位置：lib/knowledge/retriever.ts:88

**问题**：`assessEvidence(chunks)` 里直接使用了 chunk 上的 `distance` 字段做阈值比较，
应当使用 `similarity = 1 - distance`。

**为什么**：`<=>` 余弦距离越小越相似，混用会导致阈值判断完全反转
（见 PRD Further Notes："distance 与 similarity 不可混淆"）。

**建议**：将阈值比较改为 `chunk.similarity >= EVIDENCE_SUFFICIENT_THRESHOLD`，
确保 `similarity` 字段已在查询阶段正确计算为 `1 - distance`。
```

---

## 六、特定场景 Checklist

### 场景 A：修改 Prisma Schema（迁移变更）

- [ ] 所有 DDL 变更在 Prisma migration 文件中，Python 侧无 DDL
- [ ] migration 文件名格式规范：`{timestamp}_{snake_case_description}`
- [ ] 若修改了 `ingest_tasks` 表：`data-pipeline/db/schema_check.py` 的字段列表同步更新
- [ ] 若新增 `KnowledgeChunk` 字段：检查是否需要同步到 `output/schemas.py`（Pipeline 读取路径）
- [ ] 向量维度变更（`vector(N)`）：必须同时更新 `Embedder.dimension`、Pydantic schema 的注释和 HNSW 索引，不允许只改一处
- [ ] 运行迁移验收：`pnpm vitest run prisma/__tests__/migration-contract.test.ts`

---

### 场景 B：新增 Pipeline 端点

- [ ] HTTP adapter 只调用 `lib/pipeline/http-client.ts` 作为 transport
- [ ] HMAC 签名通过 `trust-adapter.ts` 构造，不在 route 中手写
- [ ] Response shape 用 Zod 或手写 guard 做运行时校验，不用 `as` 断言
- [ ] `contract-parity.test.ts` 中增加对应的 shape 验证
- [ ] Python 侧：HMAC 验签在 `pipeline_trust.py`，业务逻辑在独立模块，router 只负责 `BackgroundTasks.add_task()`

---

### 场景 C：新增检索过滤维度

- [ ] 新增的过滤条件不得绕过 `LEGAL_GATES` 或 `OPERATIONAL_GATES`
- [ ] 时间相关过滤必须通过 `buildTemporalFilter` 参数化注入，经 `extraFilter` 传入
- [ ] 管辖地过滤不得加入 SQL WHERE 子句（ADR-0004），应在应用层 `rerankByAuthority` 处理
- [ ] 补充对应的 `detectTemporalIntent` / `detectLatestIntent` 测试用例
- [ ] 更新 `lib/knowledge/AGENTS.md` 的检索逻辑说明

---

### 场景 D：修改 Embedding 相关逻辑

- [ ] `embedding_identity` 计算公式不变：`SHA256(document_id + content_hash + model + dimension)`
- [ ] 向量维度 1024（`BAAI/bge-large-zh-v1.5`）不可运行时切换
- [ ] Embedding 失败不得改变 `verification_status`
- [ ] 重试计数通过 `embedding_attempts` 字段追踪，上限 3 次
- [ ] `embedding_job.py` 必须委托 `output/embedding_lifecycle.py`，不重复实现向量生命周期逻辑

---

### 场景 E：上线前 Release Readiness

- [ ] `verification_method = 'auto'` 的 chunk 数量为 0
- [ ] `verification_status = 'disputed'` 的 chunk 数量为 0
- [ ] `FAILED` Answer 中没有缺少 `failed_at` / `error_code` / `error_message` 的记录
- [ ] 运行：`pnpm release:readiness`（需要 `DATABASE_URL`）

---

## 七、不在审查范围内（明确豁免）

以下内容**不作为 Blocker 或 Suggestion**，除非明显损害可读性：

- 代码缩进风格（由 ESLint / Black 自动处理）
- 注释是否使用中文或英文（一致即可）
- 函数命名中的 camelCase vs snake_case（各语言遵循各自惯例）
- 变量名长度（`i` vs `index`，语境合理即可）
- `async/await` vs `.then()` 链式写法（统一风格即可）

---

## 八、FAQ

**Q：合约文件只改了注释，需要跑 contract-parity 测试吗？**  
A：需要。注释可能影响 Pydantic 字段描述，而 parity guard 读取的是完整文件内容模式。

**Q：Pipeline 测试失败但 WebApp 测试通过，可以先合并 WebApp 侧？**  
A：不可以。跨引擎变更（合约、schema）必须两侧同时通过才能合并，分拆合并会造成生产窗口期不一致。

**Q：`no_evidence` 确定性答案不调用 DeepSeek，还需要写 AuditEvent 吗？**  
A：需要。所有答案路径（包括确定性模板答案）都必须进入 Answer 审计链，这是合规要求，不是可选项。

**Q：发现 Blocker 但作者在 Review 过程中提交了修复，是否需要重新走全流程？**  
A：是。修复 Blocker 的 commit 提交后，至少需要 Reviewer 确认该 Blocker 已消除，然后继续或重新进行领域审查。不可在原评论上标注"已修复"就直接合并。

---

*本文档基于 `AGENTS.md`、`caishui-webapp-architecture_v2_1.md` 和 `docs/prd/caishui-mvp-prd.md` 提炼，应与架构文档保持同步。如架构决策（ADR）发生变更，需同步更新本文档对应检查项。*
