# 代码审查快速 Checklist

> 精简版，供 PR Review 时逐项勾选。完整说明见 `docs/CODE_REVIEW_STANDARDS.md`。

---

## 🔴 Blocker（有任何一项未通过 → 驳回）

### B1 服务端/客户端边界
- [ ] Prisma 未出现在 `'use client'` 组件、hooks 或 `lib/utils/`
- [ ] `lib/db/` 模块无 `'use client'` 指令

### B2 检索层隔离
- [ ] `app/api/chat/route.ts` 无直接 Prompt 拼装或 DeepSeek 调用
- [ ] 无 UI 组件直接调用 Embedding / DeepSeek API
- [ ] `lib/db/` 查询函数无业务逻辑（retrieval filter、evidence policy）

### B3 JSON 合约一致性
- [ ] `types/pipeline.ts` 与 `output/schemas.py` 字段集合对齐
- [ ] 无 `as` 断言、`Partial<>`、`Any`、`dict` 掩盖类型不兼容
- [ ] 枚举值大小写一致（`DocType`、`ChunkType`）
- [ ] `pnpm vitest run lib/pipeline/__tests__/contract-parity.test.ts` 通过

### B4 DDL 唯一所有者
- [ ] 无 Alembic migration / `create_all()` / 原始 `CREATE TABLE`
- [ ] 所有 schema 变更在 Prisma migration 文件中

### B5 有效适用性门控
- [ ] 默认检索未绕过 `verification_status='verified'` 门控
- [ ] 默认检索未绕过 `embedding_status='COMPLETED'` 门控
- [ ] 默认检索未绕过两层 `retrieval_status='RETRIEVABLE'` 门控
- [ ] 默认检索未绕过 `is_current_version=true` 门控
- [ ] 时间过滤使用 `Prisma.Sql` 参数化，无字符串拼接 Raw SQL

### B6 Distance/Similarity 语义
- [ ] 无用 `distance DESC` 排序（应为 `distance ASC`）
- [ ] 无用 `distance` 直接与相似度阈值比较
- [ ] 无通过 `Prisma.findMany` 读取 `embedding` 向量值

---

## 🟡 Suggestion（强烈建议修复）

### 检索与问答
- [ ] 检索 Provider 失败走 `retrieval-failure-answer.ts`（非 `no_evidence` 降级）
- [ ] 所有确定性答案（`no_evidence` / `needs_clarification`）写入 Answer 审计链
- [ ] Grounding 失败时 Answer 转 `FAILED`，前端只显示重试提示，不泄露内部错误
- [ ] Prompt citation-marker hardening 使用 `PROMPT_TEMPLATE_VERSION = v1.1`；提示词行为变化时同步递增版本并补测试

### Pipeline 通信
- [ ] 新增 Pipeline 调用使用 `lib/pipeline/http-client.ts` transport
- [ ] Route handler 不手写 HMAC headers
- [ ] `status: 0` 映射为 HTTP 502，不传给 `NextResponse`
- [ ] Upload / Preview route 在读取 bytes 或调用 pipeline 前调用共享文件输入校验，不接受危险文件名、空文件、超大文件或不支持扩展名

### API Route 边界
- [ ] `app/**/route.ts` 只导出 Next.js 支持的 handler/config；parser、validator、pagination helper 放在 owning Module 或通过 route public behavior 测试
- [ ] Query / pagination 参数在 route 边界归一化为有限安全值，非法数字不会以 `NaN` 进入 DB query Module

### 来源生命周期
- [ ] 撤出/恢复操作在同一事务中更新 Document + Chunk，并追加 CitationAnnotation
- [ ] 硬删除前检查历史 AnswerCitation 引用，有引用则拒绝
- [ ] AuditEvent 与业务状态在同一事务提交

### Embedding 生命周期（Python）
- [ ] 只有 `verified` chunk 调用 Embedding API
- [ ] Embedding 失败不改变 `verification_status`
- [ ] 重试上限 3 次，达到上限设 `embedding_status=FAILED`

### 前端错误处理
- [ ] provider 原始错误不暴露给用户（401 / timeout / stack）
- [ ] 浏览器侧 SSE 解析经过 `chat-sse-protocol.ts`

### 会话历史权限
- [ ] 多用户/生产部署前，`conversationId` 历史读取必须有服务端 ownership/tenant 校验；浏览器生成 ID 仅适用于 MVP/local。

---

## 💭 Nit（可选）

- [ ] 函数/变量命名与领域术语一致（见 PRD Further Notes 词汇表）
- [ ] 注释/日志中 Chat provider 标注为 DeepSeek，Embedding provider 标注为 SiliconFlow
- [ ] 新增 Module 在最近的 `AGENTS.md` 中有简短说明
- [ ] 生成文件已清理（`.next/`、`__pycache__/`、`.pytest_cache/`）

---

## 自动检查命令参考

```powershell
# WebApp
cd caishui-webapp
pnpm typecheck
pnpm test                       # vitest run --pool=forks
pnpm vitest run lib/pipeline/__tests__/contract-parity.test.ts

# Pipeline
cd data-pipeline
$env:PYTHONUTF8="1"
.\.venv\Scripts\python -m pytest

# 上线前 Release Gate（需要 DATABASE_URL）
cd caishui-webapp
pnpm release:readiness
```
