# 代码审查修补执行策略

> 原始扫描建议已备份到 `CODE_REVIEW_EXECUTION_STRATEGY.md.backup`。  
> 本文是按当前 v2.1 架构、模块 `AGENTS.md` 和已完成修补结果整理后的执行模板。

---

## 1. 适用范围

本文用于后续处理代码审查发现的安全边界、正确性、冗余和文档漂移问题。执行时必须遵循：

- 一次只做一个可观察行为。
- 行为变更必须 TDD：RED -> GREEN -> refactor。
- 纯文档或注释变更不伪造测试，但要说明无运行时代码变化。
- 测试必须走 public interface，不测试私有实现。
- 不为测试从 `app/**/route.ts` 导出 parser、validator 或 helper。

已在本轮完成并验证的修补包括：

- Upload / Preview 文件输入边界加固。
- Documents API pagination 参数归一化，避免 `NaN` 进入 DB query。
- Conversation identity MVP ownership 风险标注。
- Chat Turn 非 `generate` 分支简化。
- `getErrorMessage` 去重。
- Runbook formatting helper 去重，并保留 Node CLI-compatible import 边界。

---

## 2. 分支与提交策略

推荐使用 **单分支 + 多点提交**：

```powershell
git checkout main
git pull origin main
git checkout -b fix/code-review-hardening
```

每完成一个垂直切片并通过 focused tests 后提交一次：

```powershell
git add .
git commit -m "fix(upload): reject unsafe upload and preview files"
git commit -m "fix(documents): normalize pagination query params"
git commit -m "docs(conversation): document MVP ownership limitation"
git commit -m "refactor(chat-turn): simplify non-generate branch"
git commit -m "refactor(smoke): deduplicate runbook formatting helpers"
```

Commit message 格式：

| type | 用途 |
| --- | --- |
| `fix` | 行为 bug、安全边界、数据正确性修复 |
| `refactor` | 不改变行为的结构整理 |
| `docs` | 文档、注释、AGENTS、架构文件 |
| `test` | 测试补充或测试夹具调整 |

不建议每个小项单独开分支；这些问题多为同一轮 code-review hardening，拆太碎会增加合并顺序和共享 helper 漂移成本。

---

## 3. TDD 垂直切片规则

每个行为切片固定顺序：

1. 读取最近的 `AGENTS.md`。
2. 写一个 public-interface 行为测试。
3. RED：确认测试失败。
4. GREEN：最小实现。
5. Refactor：只在 GREEN 后做。
6. 跑 focused tests。
7. 跑相关模块 tests。
8. 跑 `pnpm typecheck`。

不得 horizontal slicing：不要一次性写完多组测试再统一实现。

可以不先写测试的情况仅限：

- 纯注释或文档变更。
- 纯重构且已有行为测试覆盖；改完仍必须跑 focused tests 和 `pnpm typecheck`。

不得跳过测试的情况：

- 安全边界，如 upload/preview validation。
- 数据正确性，如 pagination/query parsing。
- 状态机或条件分支，如 chat turn policy。
- 跨 WebApp/Pipeline contract 或 runbook CLI import 边界。

---

## 4. 已确认的执行边界

### 4.1 Upload / Preview 输入边界

后端验证是唯一安全边界，前端验证只是体验优化。

必须使用 `lib/knowledge/upload-validation.ts`：

- 允许扩展名：`.pdf`、`.md`、`.txt`、`.csv`、`.xlsx`。
- 拒绝空文件。
- 拒绝超过 `MAX_UPLOAD_BYTES = 20 * 1024 * 1024` 的文件。
- 拒绝空文件名、路径分隔符、`..`、控制字符。
- Preview 和正式 upload 必须使用同一套验证逻辑。
- 验证必须发生在 `arrayBuffer()`、SourceDocument 创建、preview snapshot 保存、pipeline 调用之前。
- 错误响应只返回安全错误码，不回显原始路径或内部异常。

不采纳：

- 不提供 `STRICT_UPLOAD_MODE=false` 绕过安全校验。
- 不把允许扩展名默认交给环境变量随意放宽。若未来需要配置化，必须作为单独架构决策处理。

### 4.2 Documents API Query Parameter Safety

分页参数必须在 route 边界归一化：

- `page=abc` -> `1`
- `pageSize=abc` -> `20`
- `page < 1` -> `1`
- `pageSize < 1` -> `20`
- `pageSize > 100` -> `100`

`NaN`、`Infinity`、负数不得进入 `lib/db/queries/*`。

重要约束：

- 不得为了测试从 `app/api/documents/route.ts` 导出 `parsePaginationParams`。
- 若 parser 需要跨 route 复用，移动到 owning Module。
- 当前只有单 route 使用时，应通过 route public behavior 测试。

### 4.3 Conversation Identity Ownership

浏览器生成的 `conversationId` 只解决 MVP/local 会话连续性，不是授权凭证。

必须标注：

- `app/qa/components/conversation-identity.ts`：客户端 ID 仅用于 MVP/local。
- `app/api/conversations/[conversationId]/answers/route.ts`：生产多用户必须添加服务端 ownership/tenant 校验。
- AGENTS/架构/checklist 中保留上线前 blocker。

当前不实现完整登录/租户体系，避免在 MVP 收尾阶段引入横向权限系统。

### 4.4 Chat Turn Branch Simplification

条件：

```typescript
policy.action === "no_evidence" || policy.action !== "generate"
```

应简化为：

```typescript
policy.action !== "generate"
```

这是纯逻辑等价 refactor。必须先确认 `chat-turn` 现有行为测试覆盖非 `generate` deterministic answer 持久化；若无覆盖，先补行为测试。

### 4.5 Error Helper / Runbook Helper Dedup

`getErrorMessage(error)` 的唯一归口是 `lib/utils/error.ts`：

```typescript
export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
```

Runbook helper 去重必须遵守 CLI import boundary：

- `.mjs` CLI 会直接从 Node 导入部分 `.ts` runbook module。
- 这些 runbook module 的内部共享 helper 必须是 Node 可解析的 relative runtime import。
- 不得使用 `@/` alias。
- 不得使用 extensionless TS-only helper import。
- 当前共享格式化 helper 使用 `lib/smoke/runbook-format.js` + `runbook-format.d.ts`。

不合并项：

- `retrieval-failure-answer.ts` 与 `provider-connectivity-diagnostics.ts` 的错误分类暂不合并。前者面向 Answer 审计和用户安全事件，后者面向 provider smoke operator diagnostics，语义不同。

---

## 5. 验收命令

### Focused 验收

按实际触达模块选择最窄命令：

```powershell
cd J:\tax\caishui-webapp
pnpm vitest run lib/knowledge/__tests__/upload-validation.test.ts
pnpm vitest run app/api/upload/__tests__/route.test.ts app/api/pipeline/preview/__tests__/route.test.ts
pnpm vitest run app/api/documents/__tests__/route.test.ts
pnpm vitest run lib/knowledge/__tests__/chat-turn.test.ts
pnpm vitest run lib/utils/__tests__/error.test.ts
pnpm vitest run lib/smoke/__tests__
pnpm typecheck
```

### 最终本地验收

```powershell
cd J:\tax\caishui-webapp
pnpm test
pnpm release:readiness
```

若改动影响 WebApp/Pipeline contract：

```powershell
pnpm vitest run lib/pipeline/__tests__/contract-parity.test.ts
```

若改动影响 pipeline：

```powershell
cd J:\tax\data-pipeline
$env:PYTHONUTF8="1"
.\.venv\Scripts\python -m pytest
```

说明：

- 使用 `pnpm typecheck`，不要绕过项目脚本直接写 `pnpm tsc --noEmit`。
- `pnpm release:readiness` 需要 `DATABASE_URL`；环境缺失是环境阻塞，不是代码失败。

---

## 6. 前端配合原则

前端可做体验层预校验，但不能作为安全边界：

- 前端提示可复用后端白名单和大小上限的展示文案。
- 后端仍必须执行完整验证。
- 不要假设 QA 页面一定有上传入口；只对真实存在的 upload UI 做适配。
- 若未来将限制暴露给前端，应通过明确的 public config/read-model，而不是在多个组件复制常量。

---

## 7. 回退策略

优先使用小提交回退：

| 场景 | 回退方式 |
| --- | --- |
| Upload 验证误拦合法文件 | 修正 validation rule 并补 regression test；必要时 revert 对应 commit |
| Pagination 修复引入回归 | revert 对应 commit，并补覆盖非法 query 的 route test |
| Chat-turn 行为变化 | revert 对应 commit，补 deterministic answer behavior test |
| Runbook helper import 错误 | revert helper 提取或恢复 `.js + .d.ts` runtime helper |

不推荐：

- 通过环境变量关闭 upload validation。
- 放宽后端安全边界来修复前端体验问题。

---

## 8. 文档同步规则

以下改动必须同步更新最近的 `AGENTS.md` 与架构文件：

- 新增 owning Module。
- 改变 route/API 边界。
- 改变 WebApp/Pipeline contract。
- 改变 runbook CLI import path 或验收顺序。
- 改变 answer/retrieval/security semantics。

本轮规则已同步到：

- `caishui-webapp/AGENTS.md`
- `caishui-webapp/lib/knowledge/AGENTS.md`
- `caishui-webapp/lib/smoke/AGENTS.md`
- `caishui-webapp-architecture_v2_1.md`
- `docs/CODE_REVIEW_CHECKLIST.md`

---

## 9. 后续使用方式

当新的 code review 扫描提出建议时：

1. 先判断是否真实问题、是否已过期、是否与架构冲突。
2. 若是行为缺陷，转为一个 TDD 垂直切片。
3. 若是纯文档/风险标注，直接改文档并说明无运行时代码变化。
4. 若建议会放宽安全边界，默认拒绝，除非形成新的 ADR。
5. 每轮结束把新增规则写回最近的 Module-local `AGENTS.md`，不要塞回根 AGENTS。

