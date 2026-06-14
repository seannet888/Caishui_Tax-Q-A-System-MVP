# PRD：财税知识库问答 WebApp（MVP）

> 来源：`caishui-webapp-architecture_v2_1.md`（架构设计 v2.1，2026-06-10）。
> 本 PRD 从用户视角描述待交付的 MVP 范围；技术约束以架构文档为准，本文不重复代码细节。
> 状态标签：`ready-for-agent`（issue tracker 未配置，暂存为本地文件）。

---

## Problem Statement

财税从业者（会计、税务顾问、财务、企业办税人员）在解答具体税务问题时，面对的核心痛点是：

- **政策时效难以判断**。财税法规更新频繁，旧政策被废止、税率被调整。通用大模型或普通知识库会把**已废止的条款或过期税率**当作现行政策给出，在财税场景这是会直接导致错误申报、滞纳金甚至法律风险的严重错误。
- **答案无法溯源**。用户拿到一个税务结论后，无法确认它出自哪份文件、哪一条、哪个文号、是否仍然有效，因而不敢把 AI 答案作为决策依据。
- **「没查到」被误读成「不存在」**。当系统检索不到某政策时，往往笼统回答"尚未出台/不存在"，而真实情况可能是"已发布但本知识库未收录"。这种绝对化表述在财税场景具有误导性。
- **地域政策差异被抹平**。社保费率、地方附加、房产税等存在显著地区差异，通用问答容易把某地数字当作全国通用答案。
- **来源可信度无保障**。普通知识库把"管理员上传过"等同于"内容可信"，缺乏针对官方法规的核验与效力层级判断。

用户需要一个**专门面向中国财税领域、对政策时效和来源可信度有硬约束、且每条结论都可溯源**的问答系统。

---

## Solution

构建一个**单人全栈可维护的财税知识库问答 WebApp（MVP）**，由两个独立工程组成（Next.js 主应用 + Python 数据清洗微服务），通过标准化 JSON 契约通信，共享一个 PostgreSQL + pgvector 实例。

用户视角的产品形态：

1. **问答页**：用户用自然语言提问，系统基于已核验的官方法规库进行向量检索，**默认只返回当前有效**（满足时效、当前版本、已核验）的内容，流式生成答案。答案中每条引用都带文号、生效日期和来源片段。
2. **时效硬护栏**：检索层默认过滤已废止/未生效/非当前版本/未核验的内容；当命中即将到期（30 天内）的政策时，答案中主动给出失效提醒。
3. **可信溯源**：每个答案生成时固化"答案生成记录"和不可变的"引用快照"，即使来源后续被撤出或修改，历史答案仍显示当时引用的原文。
4. **诚实的不确定性**：区分"未检索到"与"未出台"；在证据不足时给出确定性模板而非编造，并展示本次检索实际覆盖了哪些来源、时间范围。
5. **地域感知**：识别用户问题中的管辖地，分组排序本地与全国材料；命中地方敏感关键词而用户未指定地区时主动询问。
6. **文档管理与清洗后台**：管理员上传 PDF/Markdown/Excel/CSV，触发异步清洗（解析 → 财税语义分块 → 元数据抽取 → 核验 → 为已核验 chunk 生成向量入库），可查看清洗进度与 chunk 分布。
7. **核验与来源治理**：reviewer 对 chunk 做人工核验；admin 管理 seed 语料、撤出/恢复来源、在严格前置条件下硬删除。所有关键动作写入只追加的审计事件。

> MVP 完成判定（端到端闭环）：
> 官方 Source Document → 解析与 chunk 级 Seed/Human 核验 → verified chunk 生成生产向量 → Effective Applicability + 管辖地 + Authority Rank 检索 → Evidence Sufficiency 门控 → 流式生成 → Citation Grounding Check → Answer Generation Record + Citation Snapshot + Audit Event。

---

## User Stories

### 问答与检索（viewer）

1. 作为财税从业者，我想用自然语言提出税务问题，以便快速获得基于官方法规的答案，而不必自己翻查文件。
2. 作为用户，我想让系统**默认只用当前有效的政策**回答我，以便不会被已废止条款或过期税率误导。
3. 作为用户，我想看到答案以流式逐字输出，以便更快感知系统在响应而不是空白等待。
4. 作为用户，我想在答案里看到每条结论对应的**文号和生效日期**，以便二次核对其权威性与时效。
5. 作为用户，我想点击/展开某条引用看到原始法规片段，以便确认 AI 没有曲解原文。
6. 作为用户，当我问"……现在是否还有效"时，我希望系统按当前效力状态回答，而不因为问题里出现了往年年份就误判为历史查询。
7. 作为用户，当我问"2023 年适用的税率是多少"时，我希望系统以我指定的时点（as-of）判断时效，而不是套用当前规则。
8. 作为用户，当我问"2023 年和现在有什么变化"时，我希望系统同时呈现历史时点版本与当前有效版本以便对比。
9. 作为用户，当我问"2023 年发布了哪些政策"时，我希望系统按发布日期检索，而不是默认只给当前有效的。
10. 作为用户，当我问"最新政策"时，我希望系统默认理解为"当前有效且生效日期最新的规范性文件"，并告诉我它用了什么排序规则。
11. 作为用户，当我问"最新发布"时，我希望系统按发布日期排序，并明确标注材料是否已失效或尚未生效。
12. 作为用户，当结果只命中官方解读时，我希望系统说明"未找到对应规范性原文，以下为官方解读"，避免我把解读当成法律依据。
13. 作为用户，当结果只命中授权性条款（"具体办法另行制定"）时，我希望系统说明授权内容并提示配套文件未收录，而不是编造具体规则。

### 时效与失效提醒

14. 作为用户，我希望系统自动排除已过失效日期的内容，以便我看不到过期政策。
15. 作为用户，当参考资料将在 30 天内失效时，我希望答案里出现明显的失效预警，以便我提前核对最新政策。
16. 作为用户，我希望答案在缺乏配套文件/具体条款时说"当前知识库未收录到相关文件/条款"，而不是说"尚未出台/不存在"。

### 不确定性与覆盖证据

17. 作为用户，当系统没有检索到相关已核验材料时，我希望它明确告诉我"未检索到"不等于"不存在"，并建议我去官方渠道核实。
18. 作为用户，我希望系统展示本次回答实际命中的来源、发布日期范围和文档类型，以便我判断答案的覆盖面。
19. 作为用户，当某官方来源的同步状态异常（stale/failed）时，我希望系统提示该来源收录可能过期，以便我额外留意。
20. 作为用户，我不希望系统仅凭"某来源没出现在本次结果里"就推断该来源缺失或抓取失败。

### 管辖地

21. 作为用户，当我提到具体地区（如"上海""广东省"）时，我希望系统优先呈现该地区的专门文件。
22. 作为用户，当我没指定地区时，我希望系统默认用全国性材料，而不是根据我的物理位置推断税务管辖地。
23. 作为用户，当我问的是地方敏感事项（社保费率、地方附加、房产税等）却没说地区时，我希望系统主动问我是哪个地区，而不是给一个可能错误的通用数字。
24. 作为用户，当同时命中国家级和地方文件时，我希望系统分别引用并说明二者关系（上位依据 vs 本地执行口径）。
25. 作为用户，当只命中地方材料时，我希望系统说明"全国性文件未命中，如你不在该地区请结合当地实际"。

### 多轮对话

26. 作为用户，我想在多轮对话里追问（如"那上海呢？"），系统能结合上文把它补全成完整问题再检索。
27. 作为用户，当我的追问缺少关键主题、系统无法可靠还原时，我希望它向我澄清，而不是猜测或编造税务事实。
28. 作为系统审计者，我希望每次问答都分别保存"原始问题"和"用于检索的 Standalone Query"以及上下文快照，以便复核改写是否引入了新事实。

### 答案可信度与一致性

29. 作为用户，我希望只有模型正常结束、且通过引用一致性校验后才看到"正式答案"，流式过程中的草稿不会被当作最终结论。
30. 作为用户，当答案未通过内部引用一致性检查时，我希望看到"请重试"而不是一个不可靠的草稿。
31. 作为用户，当我中途关闭页面再回来重试时，我希望得到一个全新的答案，而不是接着失败的草稿继续写。
32. 作为合规负责人，我希望每个答案都记录所用模型、Prompt 模板版本和检索覆盖证据，以便日后审计为何这样回答。
33. 作为合规负责人，我希望每条引用都保存不可变快照（文号、标题、证据片段、内容 hash、来源位置、回答时间），即使来源后来被撤出或删除，历史答案仍能还原当时引用。
34. 作为用户，当我查看历史答案而其引用来源已被撤出时，我希望看到"该来源已撤出，但保留回答时的原文快照"的提示，且不再提供原文件下载链接。

### 文档上传与清洗（admin / 单人开发者）

35. 作为管理员，我想上传 PDF/Markdown/Excel/CSV 官方文档，以便把它们纳入知识库。
36. 作为管理员，我想在上传后立即拿到一个任务 ID 并看到异步清洗进度（已完成 chunk / 总 chunk），而不必同步等待。
37. 作为管理员，我希望系统通过文件 hash 防止同一文件重复入库。
38. 作为管理员，我想在入库前预览清洗后的 chunk 结果，以便确认分块和元数据抽取是否合理。
39. 作为管理员，我想在文档列表里看到每份文档的处理状态（PENDING/PROCESSING/COMPLETED/FAILED）和检索状态（RETRIEVABLE/WITHDRAWN）。
40. 作为管理员，我想查看单份文档的 chunk 分布详情，以便排查清洗质量。
41. 作为管理员，当清洗失败时我希望看到错误信息以便决定重新上传。

### 分块、元数据与向量

42. 作为系统，我需要按财税法规的条款边界（"第 X 条"等）和标题层级分块，并保持表格完整，以免切断条款语义。
43. 作为系统，我需要用纯正则从文档抽取文号、发布日期、生效/失效日期、管辖地、发文机关、来源渠道、效力层级（authority_rank）等元数据，MVP 不调用 LLM 做元数据抽取。
44. 作为系统，我只为 `verification_status = verified` 的 chunk 调用 Embedding API 生成生产向量；unverified/rejected 的向量必须为空。
45. 作为系统，我需要对 embedding 做应用层幂等（按 document_id + content_hash + 模型 + 维度），相同配置已有成功结果时复用，避免重复计费。
46. 作为系统，当 embedding 失败时我需要保留核验状态、记录错误，并最多自动重试 3 次，之后转 FAILED 等人工触发。

### 核验（reviewer / admin）

47. 作为审核员，我想对自动规则无法确认的 chunk 做人工核验（Human-Verified），并记录审核人、时间、补齐字段和官方依据。
48. 作为管理员，我想把 MVP 初始验收集中的少量官方材料以 Seed-Verified 方式逐 chunk 标记入库，而不是整份文件一键 verified。
49. 作为系统，我需要拒绝（rejected）结构不合格的 chunk（空内容、表格损坏、缺权威标识等），记录可操作的拒绝原因，且不为其生成向量。
50. 作为合规负责人，我希望 MVP 上线前 `verification_method = 'auto'` 和 `verification_status = 'disputed'` 的记录数都为 0，因为这两者是未来预留、MVP 不产出。
51. 作为审核员，我不希望存在任何"强制覆盖"（manual_override）入口绕过核验规则。

### 来源治理与权限（admin）

52. 作为管理员，我想默认通过"撤出检索"（Withdraw From Retrieval）下线一个来源，而不是物理删除，以保留审计与历史溯源。
53. 作为管理员，撤出来源时我需要填写原因，系统记录撤出人/时间/原因，且该操作可逆。
54. 作为管理员，只在满足严格前置条件（无未归档历史引用、二次确认、填写原因、明确不可恢复提示）时，我才能对来源执行硬删除。
55. 作为系统，撤出某来源只影响该 Source Document 产生的 chunk，不影响其他来源的 chunk。
56. 作为系统，我需要按 `viewer`/`reviewer`/`admin` 三种可组合角色做服务端权限校验；管理员身份不自动获得人工核验权限。
57. 作为部署者，我希望身份来源在本地开发用环境变量、在部署环境只信任内网反向代理注入的用户头，禁止公网直接信任客户端传入的身份头。

### 审计

58. 作为合规负责人，我希望文档上传、清洗起止、人工核验、来源撤出/恢复、硬删除尝试/拒绝/成功、seed 增删、引用标注等动作都写入只追加的审计事件。
59. 作为合规负责人，我希望业务状态更新与审计事件在同一数据库事务中提交，且审计载荷不含敏感凭据或完整 Prompt。

### 证据充分性门控

60. 作为系统，在调用模型前我需要评估证据充分性（NO_EVIDENCE / LIMITED_EVIDENCE / SUFFICIENT_EVIDENCE）：无证据时直接返回确定性模板不调用模型；有限证据时声明依据有限、只总结所给材料；充分时正常生成并仍走引用一致性校验。

---

## Implementation Decisions

### 总体架构

- **两工程分离**：`caishui-webapp/`（Next.js 14.2 App Router + TypeScript 5.4 strict + Prisma 5.14）与 `data-pipeline/`（Python 3.11 + FastAPI 0.111 + Pydantic v2），通过标准化 JSON 契约通信，互不直接依赖代码。
- **共享一个 PostgreSQL 16 + pgvector 0.7.x 实例**。所有 DDL（含 data-pipeline 独占读写的 `ingest_tasks` 表、向量/JSONB 索引）**统一由 Prisma migration 管理**，禁止 Prisma/Alembic 双重迁移。
- **不使用 RAG 框架**（无 LangChain/LlamaIndex）。检索路径为纯 SQL + 字符串拼接 + DeepSeek 调用。
- **Embedding 固定为硅基流动(SiliconFlow) `BAAI/bge-large-zh-v1.5`，1024 维**（DeepSeek 无 embedding API，见 ADR-0006），与 DeepSeek chat 分属两个提供商/两套 key；维度为数据库 Schema 与索引硬约束，运行时禁止切换不同维度模型。
- **异步清洗用 FastAPI `BackgroundTasks` + 数据库状态表**，不引入 Celery/Redis；接受进程重启可能丢失执行中任务。
- **核心服务用长期运行 Node.js/Python 容器**，禁止 Serverless 部署（依赖长连 SSE、AbortSignal、常驻后台任务）。

### 待建/修改的深模块（核心，可独立测试）

> 设计原则：把复杂度封装在接口稳定、可隔离测试的深模块里。以下为 MVP 关键深模块及其对外接口语义。

**检索层 `lib/knowledge/`（铁律：所有问答逻辑只能经此层）**

- `retriever.ts` — 向量检索 + Effective Applicability 硬过滤 + 时间意图路由 + 管辖地分组 + Authority Rank 应用层二次排序。输入查询向量与可选管辖地，**同时返回** `chunks` 与 `coverageEvidence`。MVP 召回 top-30，应用层重排取 top-5。
- `prompt-templates.ts` — 构建财税专用 Prompt，注入全局覆盖范围、本次检索覆盖证据、失效预警、最新政策/管辖地约束。带版本号 `PROMPT_TEMPLATE_VERSION`；当前 citation-marker hardening 的默认版本为 `v1.1`，提示词行为实质变化时必须递增并补测试。
- `stream-handler.ts` — 经 axios 调用 DeepSeek REST，SSE 转发到前端。**流式 Chat 禁止自动重放**；仅非流式可重放请求（如 Embedding）使用带 `axios-retry` 的 client（指数退避 1s→2s→4s，对 429/502/503）。
- `coverage.ts` / `coverage-evidence.ts` — 全局覆盖范围（Global Coverage Scope，背景信息）与每次检索动态生成的 Retrieval Coverage Evidence；全局可声明截止日期由最旧的健康来源同步日期推导，不硬编码。
- **Standalone Query 生成器** — 输入最近 N 轮（默认 5）+ 当前问题，输出 `{ ready, query, contextSnapshot }` 或 `{ needs_clarification, question, contextSnapshot }`。只补全用户已明确提供的主题/时间/管辖地/意图，**不得新增税务事实**；MVP 用规则 + 固定示例，不额外调用模型。
- **时间意图检测 `detectTemporalIntent`** — 返回 `current_validity | as_of | publication_period | historical_comparison | current_applicability`，并据此构建参数化时效过滤（必须返回 `Prisma.Sql`，日期参数绑定，禁止字符串拼接进 Raw SQL）。
- **最新意图检测 `detectLatestIntent`** + `buildLatestOrder` — 区分 `current_effective_policy | latest_publication | latest_interpretation | rule_status` 并决定排序与过滤。
- **权威性重排 `rerankByAuthority` / `scoreChunk`** — 评分 = similarity·0.55 + authority·0.30 + recency·0.15；指定管辖地时先分组（本地 vs 其他），本地优先但保留上位依据补充。
- **证据充分性 `assessEvidence`** — 三态门控。阈值 `EVIDENCE_SUFFICIENT_THRESHOLD`（默认 0.55，须 [0,1] 校验）为原型初值，生产值必须用标注集校准。

**答案与引用（Next.js 服务端）**

- **流式答案状态机**（来自原型，编码了关键决策）：

  ```text
  GENERATING -> COMPLETED   // 模型正常结束 + 通过 Citation Grounding Check + 原子事务提交
  GENERATING -> FAILED      // 模型/SSE/事务失败，或 grounding_failed，或 client_disconnected
  ```
  - 请求开始即创建 GENERATING Answer，固化原始问题、retrieval_query、context_snapshot、model、prompt_template_version、coverage_evidence_snapshot。
  - 流式 token 只写 `draft_text`，不写 `answer_text`、不建最终 Citation Snapshot。
  - 收到 `[DONE]` 后先做 Citation Grounding Check，通过才在单事务内写 `answer_text` + Citation Snapshots + `completed_at` 并转 COMPLETED。
  - 收到 `[DONE]` 并进入最终事务后，客户端断开不得取消提交。

- **Citation Grounding Check `checkCitationGrounding`** — 校验 `[n]` 引用编号合法且不越界；答案中出现的可识别文号必须存在于某条 Citation Snapshot 的 `docNumber`；移除未被引用的 citation。MVP **只做结构与文号匹配**，不做税率/金额/期限的语义蕴含校验。失败则 Answer 转 FAILED、`error_code = grounding_failed`，前端只显示重试提示。
- **Citation Snapshot 写入校验 `assertCitationSnapshot`** — 写入前运行时校验 chunkId 形态、content hash 为 64 位 hex、标题/来源非空、证据片段非空且 ≤ 2000 字符、表格标记一致、回答时间可解析。证据片段须为最小完整语义单元，超限在语义边界截断并置 `isTruncated`，禁止伪造连续原文。`chunkId` 是 `KnowledgeChunk.id`（CUID），非 pipeline 的 SHA-256 chunk_id。
- **来源撤出 `withdrawSourceWithAudit`** — 校验 admin 角色 + 原因非空，事务内更新 Document 与其 chunk 的 `retrieval_status = WITHDRAWN` 并写 Audit Event。

**数据访问 `lib/db/`（铁律：查询函数只做读写，不含业务逻辑）**

- `queries/chunks.ts` — `updateChunkEmbedding`（`$executeRaw` 写 `vector`）、`searchByVector`（`$queryRaw` 返回 distance 与 similarity = 1 − distance）。`<=>` 为余弦距离，排序用 `distance ASC`，应用层二次排序只用 `similarity DESC`，**禁止把 distance 当 similarity**。Prisma `findMany` 取回的 `embedding` 恒为 null（Unsupported 类型设计限制），取向量值须用 `$queryRaw`。
- `queries/documents.ts` — SourceDocument 列表/详情查询。

**Python 清洗 `data-pipeline/`**

- `loaders/`（`base_loader` 抽象基类 + `pdf_loader`/`md_loader`/`excel_loader`）— 解析为 Markdown/结构化文本。
- `transformers/chunker.py` — 财税语义分块：按 `#`/`##` 标题分层 → 按条款正则 `(?=^第[零一二三...\d]+[条款章节]\s)` 切分 → 表格整体保留 → 超长（>1024 tokens）按句切分 → 相邻重叠 50 tokens；无条款编号时降级为按 `\n\n` 段落切分。目标 512 / 最大 1024 / 最小 50 tokens。
- `transformers/metadata_enricher.py` — 纯正则推断 `authority_rank`（LAW100…DERIVED_REFERENCE30，无法判定留 null）与 `extract_publish_date`（优先页面元数据，其次标题/落款正则）。
- `transformers/embedder.py` — 硅基流动 `BAAI/bge-large-zh-v1.5`，1024 维。
- `transformers/verifier.py` — `validate_seed_chunk`（最低结构校验）。
- `output/schemas.py` — Pydantic v2 标准输出契约（`TaxMetadata`/`ChunkOutput`/`PipelineOutput`），见下「API 契约」。
- `output/writer.py` — 写 PostgreSQL；`persist_chunk` 实现"仅 verified 才 embed + 应用层幂等 + 最多 3 次重试"逻辑；`mark_seed_verified` 实现 seed 校验与标记。
- `api/routers/`：`POST /ingest`（建任务记录 → BackgroundTasks → 立即返回 task_id）、`GET /status/{task_id}`（按 `completed_chunks/total_chunks` 算进度）、`POST /preview`（只返 chunk 预览不入库）。

### 关键 Schema 决策（Prisma）

- 表：`Document`、`KnowledgeChunk`、`Answer`、`AnswerCitation`、`CitationAnnotation`、`AuditEvent`，外加 SQL 迁移管理的 `ingest_tasks`。
- 枚举：`ProcessingStatus`、`DocType`、`FileType`、`EmbeddingStatus`、`RetrievalStatus`、`AnswerStatus`。TS 业务代码必须使用 Prisma 生成的枚举，Raw SQL 中参数绑定并显式 `::"EnumType"` 转换，禁止散落手写状态字符串。
- 向量字段 `embedding Unsupported("vector(1024)")`；HNSW 索引（`vector_cosine_ops`, m=16, ef_construction=64）与 metadata GIN 索引、`expire_date` 部分索引通过迁移 SQL 创建。
- `KnowledgeChunk` 关键字段：`pipeline_chunk_id`（SHA256(file_hash+chunk_index)）、`content_hash`、`embedding_*`（status/error/identity/model/dimension/attempts/last_attempt_at）、`verification_*`、`provision_type`/`answer_role`、`is_current_version`、`retrieval_status` + 撤出三字段、冗余的财税过滤字段。
- 外键 `onDelete: Restrict`；硬删除前服务层显式检查映射、历史引用与审计依赖。
- Chunk 身份三件套：`KnowledgeChunk.id`（CUID，关联用）、`pipeline_chunk_id`（来源内稳定位置）、`content_hash`（内容身份）。写入幂等至少用 `document_id + pipeline_chunk_id + content_hash`。

### API 契约（铁律三：`types/pipeline.ts` 是唯一类型契约）

- Python `output/schemas.py`（Pydantic）与 TS `types/pipeline.ts` 必须结构镜像：`DocType`、`ChunkType`、`TaxMetadata`、`ChunkOutput`、`PipelineOutput`。
- API Route 接收 data-pipeline 响应时必须用 Zod 或手写 guard 做运行时校验；禁止 `as` 断言、`Partial<>`、`any` 掩盖不兼容。
- MVP `TaxMetadata` 只填 13 个字段（正则/来源配置/页面元数据来源）；`tax_category`、`industry`、`tax_rates`、`keywords` 等留空待未来离线 LLM 补充。

### 三条开发铁律（代码审查 Blocker）

1. **服务端/客户端边界**：Prisma 只能在 Server Components / API Routes / Server Actions 使用；禁止出现在 `'use client'` 组件、hooks、`utils/`。
2. **检索层隔离**：问答逻辑只能经 `lib/knowledge/`；禁止在 API Route 直接拼 Prompt 调 DeepSeek、在组件直接 fetch DeepSeek、在 `lib/db/` 查询里写业务逻辑。
3. **类型契约不可破坏**：见上「API 契约」。

### 限流与并发

- 应用层 `p-queue`（`concurrency` + `intervalCap`/`interval` 同时配置；本地开发不限流）；生产网关层 Nginx `limit_req`。
- DeepSeek RPM/TPM 无公开统一值，开发前须在控制台确认实际限额再配 `DEEPSEEK_RPM`/`DEEPSEEK_MAX_CONCURRENCY`。
- 并发基线：`PRISMA_CONNECTION_POOL_MAX=30`，自托管 4 vCPU/8GB+ 容器，上线前 k6/Artillery 压测目标 p99 < 5s。

---

## Testing Decisions

### 什么是好测试

- **只测外部行为，不测实现细节**：对深模块测其接口契约（给定输入 → 期望输出/状态），不耦合内部函数命名或私有结构，使重构不破坏测试。
- 优先测**可隔离的纯逻辑深模块**（分块、时间意图、引用一致性、证据充分性、Standalone Query、Citation Snapshot 校验、权威重排），它们无需数据库或网络即可测。
- 端到端检索质量用**固定回归集**度量，不依赖 LLM 生成的随机性。

### 工程开工前：端到端原型（1–2 天，必须先完成）

- 纯 Python 脚本（`test_ingest.py` / `test_retrieve.py` / `test_qa.py`），不依赖前端或 PostgreSQL，用内存验证 PDF → 分块 → Embedding → 检索 → Prompt → 答案闭环。
- 测试文档集：5 份代表性官方法规（增值税暂行条例、2023 年第 1 号小规模纳税人公告、2023 年第 7 号研发费用加计扣除公告、企业所得税法实施条例、2023 年第 2 号全年一次性奖金公告）。
- 测试问题集：10–15 个跨税种、跨时效场景（含废止查询、法规引用、跨境、发票等）。
- 验收：人工 1–5 分，≥80% 问题得分 ≥4；维度为无幻觉、文号引用正确、时效过滤生效、回答清晰。

### 需要写测试的模块（建议）

- **`chunker.py`（Python，必测）**：选 3–5 份典型法规 + 人工标注 10–15 个问答对与预期 chunk，验证分块后召回率 ≥ 90%（@3）。fixtures：`tests/fixtures/sample.{pdf,md,xlsx}`。
- **`pdf_loader.py` / `excel_loader.py`（Python）**：对样本文件断言解析输出结构（标题层级、表格保留、页码元数据）。
- **检索召回回归（CI，必测）**：把问题集 + 标注预期来源 chunk 固化为用例，只检查 top-3 是否命中正确 chunk（不调用 LLM）；每次 Schema 或检索逻辑变更后自动对比召回率。
- **`checkCitationGrounding`（TS，必测）**：构造合法/越界编号、`[0]`/负数、未匹配文号、未被引用 citation 等用例，断言 `ok`/`errors`/`usedCitationIndexes`。
- **`assessEvidence`（TS）**：覆盖零召回、低权威来源、管辖地不匹配、只有官方解读、只有授权性条款等场景，断言三态划分。
- **`detectTemporalIntent` / `detectLatestIntent`（TS）**：用 5.1/5.5 表中的例句断言意图分类，含"问题含往年年份不等于历史查询"的反例。
- **Standalone Query 生成器（TS）**：断言"那上海呢？"类追问被正确补全；缺主题时返回 `needs_clarification`；不引入新事实。
- **`assertCitationSnapshot`（TS）**：断言非法 chunkId/hash/超长片段/表格标记不一致被拒。
- **流式答案状态机（TS，集成）**：模拟正常完成、grounding 失败、客户端断开、上游中断，断言状态流转与持久化（不写 answer_text 草稿、断开后新建记录）。

### 数据质量断言（MVP 上线前必须满足）

- `SELECT COUNT(*) FROM knowledge_chunks WHERE verification_method = 'auto'` 必须为 0。
- `SELECT COUNT(*) FROM knowledge_chunks WHERE verification_status = 'disputed'` 必须为 0。
- rejected chunk 的 `embedding` 必须为 null 且 `verification_notes` 非空。
- seed corpus 须在测试报告中列明文件名、来源 URL、导入时间、负责人。

### 内置质量护栏（始终生效，即便召回/生成正确）

1. 强制时效过滤（排除已失效 chunk）。
2. 答案强制标注文号与生效日期。
3. 证据充分性三态门控（阈值由标注集校准，不用固定 `similarity < 0.7`）。
4. Prompt 强制不确定性声明。

---

## Out of Scope

> 以下能力 MVP 不实现，也不得在文案/演示/验收中暗示已具备（详见架构文档第八章）。

**数据建模**
- 不建独立的 `TaxAuthorityDocument`/`AuthorityTextVersion`/`AuthorityProvision`/`EmbeddingRecord` 表。
- 不实现法规版本图谱、替代关系图、自动修订影响分析、跨来源 chunk 合并/provenance 转挂/全局向量去重。

**核验与质量**
- 不实现 Auto-Verified（`verification_method='auto'` 仅预留，数据中须为 0）。
- 不实现跨来源全文一致性自动核验；不做税率/金额/期限的语义级事实蕴含校验（MVP 仅结构 + 文号匹配）。
- 不实现法规冲突自动识别/裁决（仅并列展示并提示人工确认）；不提供 `manual_override` 等绕过入口。

**检索与问答**
- 不实现 Cross-Encoder/LLM reranker（仅应用层轻量规则排序）。
- 不实现全文检索（zhparser/pg_trgm，保留为未来可选）。
- 不实现多轮对话中的自主事实补全；不实现答案的完整语义/法律审查。
- `NO_EVIDENCE` 状态禁止模型凭记忆生成财税答案。

**基础设施**
- 不实现完整自动爬虫、不承诺官方渠道全覆盖。
- 不引入 Celery/Redis（用 BackgroundTasks，接受进程重启丢任务）；不实现分布式限流/重试/跨节点协调/实时变更推送。

**产品与权限**
- 不实现多租户、组织隔离、复杂 ABAC/RBAC（仅 viewer/reviewer/admin 可组合基础角色）。
- 不把"管理员上传/处理完成/seed 成员"宣传为自动可信；不把"未检索到"宣传为"不存在/未出台"；不把官方解读/地方口径/案例宣传为高于规范性原文的法律依据。

---

## Further Notes

- **领域语言保持一致**：Effective Applicability（有效适用性）、Authority Rank（效力层级）、Source Document / Knowledge Chunk、Withdraw From Retrieval vs Remove Source、Citation Snapshot、Answer Generation Record、Retrieval Coverage Evidence、Evidence Sufficiency、Standalone Query、Seed/Human-Verified —— 在 issue、代码、文档中统一沿用，不另造同义词。
- **时效过滤是本系统区别于普通知识库的最关键约束**，属于硬护栏而非可选项；任何放宽都必须先识别用户时间意图。
- **distance 与 similarity 不可混淆**是反复强调的实现陷阱，应在 review checklist 中固化。
- **阈值（`EVIDENCE_SUFFICIENT_THRESHOLD` 等）的生产值必须用标注问答集校准**，文档中的 0.55 仅为原型初值。
- **部署形态约束**：核心服务（长连 SSE + 常驻 BackgroundTasks）禁止 Serverless；腾讯云可用 TDSQL-C Serverless（内置 pgvector ≥0.7、HNSW）+ TKE/轻量服务器/CVM 常驻容器 + COS 文件存储。
- **本 PRD 未发布到 issue tracker**：当前仓库未配置 issue tracker / triage 词表（`/setup-matt-pocock-skills` 未运行），故按用户选择暂存为本地文件 `docs/prd/caishui-mvp-prd.md`。配置 tracker 后可再用 `/to-issues` 拆分为可独立认领的纵向切片。
- **建议的首批纵向切片**（供后续 `/to-issues`）：① schema + 迁移（含向量/JSONB/部分索引）；② Python 清洗最小闭环（pdf_loader + chunker + metadata_enricher + writer + seed 标记）；③ 检索层 retriever + 时效过滤 + coverage-evidence；④ /api/chat 流式 + 状态机 + grounding check + citation snapshot；⑤ 上传/状态后台 + 文档列表；⑥ 核验/撤出/审计 + 权限。每片以端到端可演示为目标。
