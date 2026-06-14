# Effective Applicability: which dimensions are hard SQL gates vs soft ranking

Effective Applicability has five dimensions. In the MVP only three are **hard SQL gates** (a chunk is excluded from results if it fails): **time** (effective & not expired, per Temporal Intent), **current version** (`is_current_version = true`), and **verification** (`verification_status = 'verified'`). The other two — **jurisdiction** and **provision-role** — are **soft**: applied via application-layer ranking/grouping and Prompt constraints, not a `WHERE` clause.

## Why soft, not hard

- **Jurisdiction:** a 上海 query must still be able to surface 全国 (national) chunks as the upper-tier basis, with a "未找到本地专门文件，以下为全国性政策" fallback. Hard-filtering on jurisdiction would delete that fallback and leave local queries with no answer.
- **Provision-role:** an authority-delegation clause ("具体办法另行制定") shouldn't vanish from retrieval — the model needs to *see* it to say "配套文件未收录." Hard-filtering would hide the very chunk that explains the gap.

## Consequences

- Do **not** add jurisdiction or `provision_type` to the retrieval `WHERE` clause to "complete" Effective Applicability. That is a regression, not a fix.
- Jurisdiction is enforced by `groupByJurisdiction` + rerank (local first, national retained) and Prompt guidance; provision-role by Prompt rules (don't answer specifics from a delegation clause alone).
- Full provision-role routing and version-chain handling are deferred; they may become harder gates in a later version, but only with explicit design.
