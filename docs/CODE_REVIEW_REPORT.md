# 代码审查报告 — 财税知识库问答系统后端
**审查日期：** 2026-06-14  
**审查范围：** `caishui-webapp/` 后端全部代码  
**审查标准：** `docs/CODE_REVIEW_STANDARDS.md` v1.0  
**审查人：** Code Reviewer Agent

---

## 总体印象

这是一份**整体质量较高**的后端代码库。架构清晰、分层合理，领域逻辑与基础设施隔离得很好，对"财税合规"这一核心约束有意识的工程化落地（时效门控、Citation Grounding Check、AuditEvent 全链路追踪）令人印象深刻。

更难得的是：代码里充满了**防御性注释**，把设计决策和潜在风险直接写在了代码旁边——这本身就是高质量审查文化的体现。

然而，在 6 处**六大铁律**的具体实现上，存在若干可改进点；在输入验证、错误处理和测试覆盖上也有一些值得关注的问题。

以下按严重程度分级列出，`🔴` 必须修复，`🟡` 建议修复，`💭` 可选改进。

---

## 🔴 阻断项（Blocker）

### B1 · `TRUST_PROXY_AUTH` 缺少反向校验，Timestamp 没有验证时效性

**文件：** `lib/auth/actor.ts`  
**影响范围：** 所有需要 Admin/Reviewer 权限的 API

**问题描述：**  
`signPipelineRequest`（`lib/pipeline/trust-adapter.ts`）在 Webapp→Pipeline 方向做了 HMAC + Timestamp 签名，但 `resolveActor`（反向，即外部请求进入 Webapp）仅依赖 `TRUST_PROXY_AUTH=true` 环境变量就信任 `X-User-Roles: admin`。

当前代码中：
```typescript
// lib/auth/actor.ts line 37-43
if (!TRUST_PROXY_AUTH) {
  // fallback to MVP env vars — OK
}
const id = headers?.userId?.trim();
// 直接信任，没有签名验证
```

注释中提到"可选再校验代理注入的共享密钥头作为纵深防御"，但这个"可选"的防线**从未实现**。一旦代理配置错误（如 nginx 的 `proxy_pass` 忘记 `proxy_set_header X-User-Roles`），攻击者仍可自伪造角色头提权。

**建议：**
```typescript
// 增加共享密钥二次验证（与 trust-adapter 对称）
if (TRUST_PROXY_AUTH) {
  const proxySecret = process.env.PROXY_SHARED_SECRET;
  if (proxySecret) {
    const provided = headers?.proxySecret;
    if (provided !== proxySecret) {
      throw new Error("proxy_auth_secret_mismatch");
    }
  }
}
```

或者至少在生产启动时记录警告："TRUST_PROXY_AUTH=true but no PROXY_SHARED_SECRET configured"。

---

### ~~B2 · `unbounded` 时效过滤绕过~~ → 设计确认正确，详见 §N1

**状态：** 经重新审查确认，`unbounded` 是**正确的设计意图**，不是 bug。

**完整证据链：**

| 层级 | 文件 | 行为 |
|------|------|------|
| SQL 过滤 | `temporal.ts:unbounded → Prisma.empty` | **不按** effective/expire 过滤，允许已失效/未生效文件进入候选 |
| Query Plan | `query-plan.ts:52-56` | 设置 `effectivityLabelRequired = true` |
| Prompt 指令 | `prompt-templates.ts:75` | 注入"逐条标明材料是当前有效、尚未生效还是已失效" |
| LLM 约束 | `prompt-templates.ts:17-19` | `LATEST_POLICY_RULES` 要求按发布日期排序但必须标注状态 |

**语义澄清：**「最新发布」的语义是"最近出版了哪些文件"，而非"当前有效的文件"，因此 SQL 层不应过滤时效。这是两阶段设计：**SQL 宽松召回 → Prompt 严格标注**。参见 `temporal.ts` 和 `query-plan.ts` 的 `unbounded` 分支注释（已补充）。

---

### B2 · `withdrawSourceWithAudit` 存在读-写竞争（Read-Modify-Write Race）

**文件：** `lib/knowledge/source-withdrawal.ts` line 36-41

**问题描述：**  
```typescript
await tx.knowledgeChunk.updateMany({
  where: { document_id: documentId },
  data: { retrieval_status: withdrawn, ... },
});

const withdrawnChunks = await tx.knowledgeChunk.findMany({
  where: { document_id: documentId },
  select: { id: true },
});
```

在同一事务内，先 `updateMany` 更新状态，再 `findMany` 读取 id 列表。理论上事务内读取是一致的，但 `findMany` 会读出**本次 update 影响范围之外的旧 chunk**（比如并发添加的新 chunk）。

更严重的问题是：上面的 `updateMany` 没有过滤条件（除 `document_id`），会把**已经 WITHDRAWN 的 chunk 再次 withdraw** 并更新 `withdrawn_at` 时间戳，破坏幂等性。

**建议：**  
```typescript
// 只 update RETRIEVABLE 状态的 chunk
await tx.knowledgeChunk.updateMany({
  where: { 
    document_id: documentId,
    retrieval_status: RetrievalStatus.RETRIEVABLE  // 增加此条件
  },
  data: { ... },
});
```

`restoreSourceWithAudit` 同样存在此问题（行 98，updateMany 没有过滤 WITHDRAWN 状态）。

---

## 🟡 建议修复项（Suggestion）

### S1 · `appendDraft` 高频写入无节流，每 Token 一次数据库写入

**文件：** `lib/knowledge/answer.ts` line 36-41  
**文件：** `lib/knowledge/answer-generation.ts` line 119-121

**问题描述：**  
```typescript
// answer-generation.ts
const delta = next.value;
answerText += delta;
await dependencies.appendDraft(answer.id, answerText);  // 每个 token 都写一次！
yield { type: "token", delta };
```

DeepSeek 流式输出每次 delta 通常是 1-5 个汉字。一次完整回答可能产生 300-500 次 token，即 300-500 次 Postgres UPDATE 操作。在高并发场景下这是严重的写放大问题。

**建议：**
```typescript
// 每 N 个 token 或每 T 毫秒写一次
let pendingTokens = 0;
const DRAFT_FLUSH_INTERVAL = 20; // 每20个token flush一次
// ...
pendingTokens++;
if (pendingTokens >= DRAFT_FLUSH_INTERVAL) {
  await dependencies.appendDraft(answer.id, answerText);
  pendingTokens = 0;
}
```

---

### S2 · `mapUploadError` 用字符串包含匹配错误码，脆弱且难以维护

**文件：** `app/api/upload/route.ts` line 74-87  
**同类问题：** `app/api/documents/[docId]/route.ts` line 17-21

**问题描述：**  
```typescript
function mapUploadError(error: unknown): NextResponse {
  const message = String(error);
  if (message.includes("forbidden_requires_role")) { ... }
  const duplicate = message.match(/source_document_already_exists:(.+)$/u);
```

通过字符串 `includes` 匹配错误码是典型的反模式：
- 错误信息格式改变时静默失效
- 无法区分 `Error.message` 中偶然包含该字符串的其他错误
- 多处重复（upload/route.ts 和 documents/route.ts 各自实现了类似逻辑）

**建议：** 定义带 `code` 字段的自定义错误类：
```typescript
class DomainError extends Error {
  constructor(public code: string, message?: string) {
    super(message ?? code);
  }
}
// 然后：
function mapUploadError(error: unknown): NextResponse {
  if (error instanceof DomainError) {
    switch (error.code) {
      case "forbidden_requires_role": return NextResponse.json(..., { status: 403 });
      case "source_document_already_exists": ...
    }
  }
}
```

---

### S3 · `chat/route.ts` 未校验 `ChatRequest` 字段合法性

**文件：** `app/api/chat/route.ts` line 38-40

**问题描述：**  
```typescript
const body = (await request.json()) as ChatRequest;
const turn = await planChatTurn(body);
```

`body` 被强转为 `ChatRequest` 而没有任何运行时验证。恶意客户端可以发送：
- `conversationId: null` → 进入 DB 查询时出错
- `question: ""` 或超长字符串 → 被注入进 Prompt
- `queryDate: "not-a-date"` → 在 `parseQueryDate` 抛出，但错误信息直接暴露给客户端

`upload/route.ts` 通过业务逻辑间接完成了部分验证，但 chat 端点没有。

**建议：**
```typescript
import { z } from "zod"; // 项目中 pipeline/ingest-client.ts 已经用了 zod，可复用

const chatRequestSchema = z.object({
  conversationId: z.string().min(1).max(100),
  question: z.string().min(1).max(2000),
  history: z.array(z.object({ role: z.enum(["user","assistant"]), content: z.string() })).optional(),
  jurisdiction: z.string().max(50).optional(),
  queryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
```

---

### S4 · `preview-persistence.ts` 使用内存 Map 存储预览快照，进程重启丢失

**文件：** `lib/knowledge/preview-persistence.ts`（根据 `app/api/pipeline/preview/route.ts` 的调用推断）

**问题描述：**  
`loadPreviewSnapshot` / `savePreviewSnapshot` 基于内存存储（根据 route 的同步调用方式推断），在以下场景会丢失数据：
- Next.js 热重载（开发环境）
- 生产环境多实例部署（Node.js cluster / 多 pod）
- 进程崩溃后重启

管理员预览是调试和生产决策的依据，丢失会造成困惑。

**建议：** 短期可写入临时文件（带 TTL）；中期建议增加 `PreviewSnapshot` 数据库表或 Redis 缓存。

---

### S5 · `temporal.ts` 的正则模式存在误判风险

**文件：** `lib/knowledge/temporal.ts` line 8-33

**问题描述：**  

`detectTemporalIntent` 用正则区分用户意图，存在以下边缘情况：

```typescript
// "现行有效的增值税税率是多少" → current_validity ✅
// "2023年财税〔2023〕33号是否还有效" → as_of（因为包含年份） ⚠️
// 但实际这是 current_validity 问题，文号包含年份不代表要查截至该年
```

`as_of` 的正则：
```
/(在|截至|截止|到).*(\d{4})年.*(适用|执行|税率|规定)|(\d{4})年.*(适用|执行|税率是多少|怎么缴)/
```

"2023年企业所得税税率是多少" 会被误识别为 `as_of`（截至2023年），而不是 `current_applicability`。这会导致查询使用"截至2023年底有效"的过滤器，漏掉2024年以后的最新规定。

**建议：** 增加针对文号格式的豁免规则，或在 `buildQueryPlan` 中对纯文号引用的 `as_of` 意图降级到 `current_applicability`。同时建议扩展测试用例覆盖更多边缘情况。

---

### S6 · `citation.ts` 的 Grounding Check 对没有文号的文件无法验证

**文件：** `lib/knowledge/citation.ts` line 120-134

**问题描述：**  
```typescript
const citedDocNumbers = new Set(
  citations.map((c) => c.docNumber).filter((v): v is string => Boolean(v)),
);
const mentionedDocNumbers = Array.from(
  answerText.matchAll(
    /(?:财税〔\d{4}〕\d+号|国家税务总局公告\d{4}年第\d+号)/g,
  ),
).map((match) => match[0]);
```

Grounding Check 只校验特定格式文号（`财税〔〕号` 和 `国家税务总局公告`），但：
1. 其他格式的文号（如"国发〔2023〕X号"、"财关税〔2023〕X号"）不在匹配范围内
2. 没有文号的文件（`docNumber` 为 null 的 chunk）根本不会被 Grounding Check

这意味着 LLM 可能引用了 Citation Snapshot 中没有的文件（幻觉），而 Grounding Check 不会捕获到。

**建议：** 考虑从反向做验证：如果答案中提到的引用编号 `[N]` 存在，则 N 必须在 citations 数组范围内（这部分已做）；同时对没有文号的引用，验证答案中是否包含其 `title`（至少部分匹配）。

---

### S7 · `hardDeleteSourceWithAudit` 的 AuditEvent 在数据已删除后写入，事务顺序有误

**文件：** `lib/knowledge/source-hard-delete.ts` line 32-55

**问题描述：**  
```typescript
await tx.knowledgeChunk.deleteMany({ where: { document_id: documentId } });
await tx.sourceDocument.delete({ where: { id: documentId } });
await tx.auditEvent.create({ data: { ... old_state: { id: previous.id, ... } } });
```

审计事件在**数据删除之后**才写入。虽然在同一事务中这是安全的，但如果 `auditEvent.create` 失败（外键、字段校验），整个事务会回滚，删除也会撤销。这是预期行为，但更好的实践是先写审计再删数据：

```typescript
// 推荐顺序：先记录审计意图，再执行破坏性操作
await tx.auditEvent.create({ ... });  // 先写
await tx.knowledgeChunk.deleteMany(...);  // 再删
await tx.sourceDocument.delete(...);  // 最后删
```

这样如果删除失败，审计记录也不会提交（事务回滚），逻辑上更清晰，也方便灾难恢复分析。

---

### S8 · `getDocument` 查询返回所有 chunks（无分页），大文档可能造成内存问题

**文件：** `lib/db/queries/documents.ts` line 25-35

**问题描述：**  
```typescript
include: {
  chunks: {
    orderBy: { chunk_index: "asc" },
    // 注意：embedding 字段在此返回恒为 null（Unsupported 类型设计限制）
  },
},
```

对于大型 PDF 文档（如税法全文），一个文档可能有数百个 chunk。全量返回会：
- 使 API 响应体过大（每个 chunk 包含完整 `content` 字段）
- 占用大量 Node.js 内存
- 序列化/反序列化开销大

`GET /api/documents/[docId]` 当前用于文档详情+chunk 预览，需要分页。

**建议：**
```typescript
export async function getDocument(docId: string, chunkOptions?: { skip?: number; take?: number }) {
  const { skip = 0, take = 50 } = chunkOptions ?? {};
  return prisma.sourceDocument.findUnique({
    where: { id: docId },
    include: {
      chunks: {
        orderBy: { chunk_index: "asc" },
        skip,
        take,
      },
      _count: { select: { chunks: true } }, // 总数用于前端分页
    },
  });
}
```

---

## 💭 细节优化（Nit）

### N1 · `unbounded` 命名不直观，容易误导审查者（如本人）

**文件：** `types/knowledge.ts` line 66-69, `temporal.ts`, `query-plan.ts`

**问题描述：**  
`temporalScope: "unbounded"` 的字面意思是"无边界 / 不限制"，审查者（包括本报告初版）容易误判为"过滤被禁用了，是 bug"。实际上它是 `latest_publication` 语义的正确实现。

**建议：**  
方案 A（轻量）：已在 `temporal.ts` 和 `query-plan.ts` 的 `unbounded` 分支补充了设计决策注释。  
方案 B（如需更彻底）：将枚举值重命名为 `allow_expired` 或 `publication_date_only`，更准确地表达"不按 effective/expire 过滤"的意图。

---

### N2 · `resolveActor` 在 `chat/route.ts` 中的结果被 `void` 掉，但在 `conversations/answers/route.ts` 同样如此

**文件：** `app/api/chat/route.ts` line 32-36  
**文件：** `app/api/conversations/[conversationId]/answers/route.ts` line 15-19

两处都有 `void actor; // viewer 即可...` 注释。这表明 actor 解析只是为了"将来用"的预留，但现在实际上任何未认证请求都能调用这两个 API（因为 `TRUST_PROXY_AUTH=false` 时用环境变量兜底）。

建议在 TODO 注释中明确写出"MVP 阶段无访问控制，上线前需实现会话 ownership 校验"，避免被误以为已做了鉴权。

---

### N3 · `Prisma.sql` 的模板字面量拼接方式在 `retriever.ts` 中有潜在的 SQL 注入风险

**文件：** `lib/knowledge/retriever.ts` line 62-64

```typescript
const docTypeFilter =
  requestedDocType === "interpretation"
    ? Prisma.sql`AND kc.doc_type = ${DocType.INTERPRETATION}::"DocType"`
    : Prisma.empty;
return searchByVector(
  queryEmbedding,
  limit,
  Prisma.sql`${temporalFilter} ${docTypeFilter}`,  // ← 嵌套 Prisma.Sql 是安全的
);
```

这里嵌套的 `Prisma.sql` 模板是安全的（Prisma 正确处理嵌套参数化）。但要特别注意：项目中 `searchByVector` 接受 `extraFilter?: Prisma.Sql`，如果将来有人在调用处直接拼字符串（如 `Prisma.sql`\`AND x = '${userInput}'\``），就会产生 SQL 注入。

建议在 `searchByVector` 的 JSDoc 注释中显式警告：
```typescript
/**
 * @param extraFilter 必须为参数化 Prisma.Sql，禁止直接拼接用户输入的字符串。
 */
```

---

### N4 · `rerank.ts` 的 `scoreChunk` 10年衰减窗口是硬编码魔法数

**文件：** `lib/knowledge/rerank.ts` line 50

```typescript
const recencyScore =
  effectiveTime > 0
    ? Math.max(0, 1 - (now - effectiveTime) / (1000 * 60 * 60 * 24 * 365 * 10))  // 10年
    : 0.5;
```

`10年` 是业务决策，不是技术约束，应提取为命名常量：
```typescript
const RECENCY_DECAY_YEARS = 10;
const RECENCY_DECAY_MS = RECENCY_DECAY_YEARS * 365 * 24 * 60 * 60 * 1000;
```

---

### N5 · `stream-handler.ts` 的 RPM 队列注释存在误导

**文件：** `lib/knowledge/stream-handler.ts` line 35-43

```typescript
// concurrency 控制同时运行数；intervalCap/interval 控制每分钟启动数。
// 生产配置必须同时考虑 RPM 与 TPM；此处只约束请求数。
const apiQueue = new PQueue({
  concurrency: Number(process.env.DEEPSEEK_MAX_CONCURRENCY ?? 10),
  intervalCap: configuredRpm,
  interval: 60_000,
});
```

注释说"此处只约束请求数"是正确的，但 `concurrency: 10` 和 `intervalCap: 60` 可能同时成为瓶颈：如果 60 RPM 的 token 响应时间较长（10-30秒），10 并发很快就会跑满。建议根据实测延迟设置 `concurrency`，或者加上 `timeout` 选项：
```typescript
const apiQueue = new PQueue({
  concurrency: Number(process.env.DEEPSEEK_MAX_CONCURRENCY ?? 10),
  intervalCap: configuredRpm,
  interval: 60_000,
  timeout: 90_000, // 单请求最大等待 + 执行时间
});
```

---

### N6 · `coverage.ts` 的全局来源健康状态是硬编码的静态值

根据 `coverage-evidence.ts` 的 import 推断，`GLOBAL_SOURCE_HEALTH` 是静态配置，不能反映真实同步状态。在 Prompt 里输出"来源健康警告"给 LLM 是个好主意，但如果健康状态永远是 `active`（静态配置），这个警告就是无效信息。

建议：要么接入真实的同步状态（pipeline 有 `/status` 接口），要么在注释中明确标注"MVP 阶段为静态配置，需接入实时监控"。

---

## ✅ 值得称赞的设计

以下是本次审查中发现的**优秀实践**，建议在团队内推广：

| 亮点 | 位置 | 为什么好 |
|------|------|---------|
| `updateChunkEmbedding` 强制校验 `embedding.length !== 1024` | `chunks.ts:49` | 防御性边界，避免维度漂移的静默失效 |
| `<=>` 距离/相似度全链路注释 | `chunks.ts:5-6` | 直接把最容易混淆的陷阱写在代码里 |
| 撤回来源时追加 `CitationAnnotation` 而非修改历史 | `source-withdrawal.ts` | 完整保留了不可变历史事实，审计安全 |
| `appendDraft` 用 `status: "GENERATING"` 作乐观锁条件 | `answer.ts:37` | 防止对已完成/失败答案的误写 |
| `parseDeepSeekStream` 正确处理 TCP 分包的 SSE 跨行问题 | `stream-handler.ts:100-133` | 生产级流式处理，避免了很多坑 |
| `signPipelineRequest` 的签名消息包含 method + path | `trust-adapter.ts:20-27` | 防止签名重放和 CSRF 攻击 |
| `hardDeleteSourceWithAudit` 检查 `historicalCitationCount > 0` 前置 | `source-hard-delete.ts:23-31` | 符合"不改变历史事实"约束 |
| 测试覆盖密度高 | `lib/knowledge/__tests__/` | 30+ 个测试文件，覆盖了几乎所有核心模块 |
| `evaluateEvidencePolicy` 的委托条款/解读条款特殊路径 | `evidence-policy.ts:47-73` | 精准的财税领域专家知识工程化 |
| `checkCitationGrounding` 在提交前验证引用编号范围 | `citation.ts:101-140` | 在 LLM 幻觉输出进入数据库前的最后一道防线 |

---

## 📊 问题汇总

| 级别 | 数量 | 分类 |
|------|------|------|
| 🔴 Blocker | 2 | 安全(B1)、并发安全(B2) |
| 🟡 Suggestion | 8 | 性能(S1)、可维护性(S2/S4)、输入验证(S3)、数据质量(S5/S6)、事务顺序(S7)、扩展性(S8) |
| 💭 Nit | 6 | 命名可读性(N1)、注释完善(N2/N5/N6)、防御性注释(N3)、代码可读性(N4) |

---

## 🚀 建议优先级

**本轮必须修复（上线前）：**
1. B2 — 撤回操作的竞态条件（幂等性问题）
2. S3 — Chat API 输入验证缺失（安全边界）

**下一个迭代修复：**
3. B1 — 代理认证的纵深防御
4. S1 — `appendDraft` 写放大优化
5. S2 — 错误码结构化（提升可维护性）

**条件许可时改进：**
6. S4-S8、N1-N6

---

*本报告由 Code Reviewer Agent 基于 `docs/CODE_REVIEW_STANDARDS.md` 生成。*  
*如有疑问或需要对某项问题深入讨论，请直接 @ 审查人。*
