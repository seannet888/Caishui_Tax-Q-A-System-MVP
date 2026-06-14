# 财税知识库问答 (Caishui Tax Knowledge Q&A)

A Chinese tax/finance knowledge-base Q&A system whose defining constraint is policy-validity correctness: an answer must never rely on an expired or superseded regulation, and every claim must be traceable to an official source.

## Language

### Sources & authority

**Source Document**:
One uploaded file from one source channel — the immutable unit of provenance. The file itself (hash, size, path), fused with where it came from. Two files of identical content from different channels are two distinct Source Documents and are never merged.
_Avoid_: Document (the bare word — it hides the file/source/law distinction), File, Upload.

**Source Channel**:
Where a Source Document was obtained (e.g. 国家税务总局官网, 财政部官网). A property of the Source Document, not an entity.
_Avoid_: Source (ambiguous with Source Document), Provider.

**Tax Authority Document**:
The legal authority a Source Document expresses (a 文号 such as 财税〔2023〕6号, with its effective dates and 效力层级). In the MVP this is **not** a modelled entity — it lives as metadata fields *on* the Source Document. Named here so its deliberate absence is explicit.
_Avoid_: modelling it as its own table in MVP; conflating it with Source Document.

**Authority Rank (效力层级)**:
The legal-precedence tier of a Source Document's content (法律 100 … 衍生参考 30; null = cannot be determined). Distinct from document type — it ranks legal force, not file kind.
_Avoid_: faking a high rank when undeterminable (must stay null).

### Knowledge Chunks & identity

**Knowledge Chunk**:
A chunked unit of a Source Document's text, permanently bound to the Source Document that produced it. The atom of retrieval, verification and citation.
_Avoid_: re-pointing it to another Source Document; treating it as the law itself.

**Chunk Row ID**:
The database CUID (`id`) — "which row is this?". Used by citations, audit, relations.
_Avoid_: the bare word "chunk_id" (ambiguous with Chunk Location ID).

**Chunk Location ID**:
`SHA256(file_hash + chunk_index)` (stored as `pipeline_chunk_id`) — "which position in which source file?". A stable *location* identity; survives re-processing of the same position.
_Avoid_: calling it "chunk_id"; treating it as a content identity.

**Content Hash**:
`SHA256(content)` — "is this the same text?". A *content* identity; changes when re-processing changes the text.
_Avoid_: using it to identify position.

**Current Version**:
The live version of a given Chunk Location ID. Invariant: **for one Chunk Location ID, at most one chunk has `is_current_version = true`**. Re-processing with changed Content Hash creates a new chunk; the old one is set `is_current_version = false` (a version fact — *not* a withdrawal) and verification does **not** carry across.
_Avoid_: using `retrieval_status = WITHDRAWN` to retire a superseded version (that's an admin action, not supersession).

### Chunk eligibility

**Effective Applicability (有效适用性)**:
Whether a chunk could *lawfully* ground an answer to the current question. The legal/semantic gate only — five dimensions: time window, version, verification, provision-role, jurisdiction. Says nothing about system plumbing.
_Avoid_: "valid", "current", "applicable" used loosely; folding operational state into it.

**Operational Retrievability**:
Whether the system *currently allows* a chunk into retrieval, independent of its legal applicability. Driven by `retrieval_status` (admin withdrawal/restore) and `embedding_status` (vector readiness). A chunk can be Effectively Applicable yet not Retrievable.
_Avoid_: treating withdrawal as a statement about legal validity.

**Withdraw From Retrieval**:
The default admin action that makes a Source Document and its chunks non-Retrievable while preserving verification, embeddings, metadata and historical citations. Reversible. Distinct from Remove Source (hard delete).
_Avoid_: "delete" for this action; implying the law is no longer in force.

### Verification

**Verified Chunk**:
A Knowledge Chunk that has a traceable official identity (文号, source channel), intact structure (passes minimum structural validation), and is vouched for by a human reviewer or a seed batch. A **provenance & structural** assurance — **not** a guarantee that its tax content is legally correct.
_Avoid_: reading "verified" as "legally correct"; any document-level "verified" flag.

**Verification Method**:
How a chunk became verified: `seed` (admin bootstraps a small, hand-picked official corpus via script) or `human` (a reviewer vouches via the back-office, recording evidence). `auto` is reserved and must be 0 rows in MVP.
_Avoid_: an admin UI button that sets `verified` directly — neither path is that.

**Reviewer / Admin**:
**Reviewer** holds the human-verify right. **Admin** manages the seed corpus, withdraws/restores and hard-deletes sources — but does **not** automatically get the verify right. Both can *produce* verified chunks, by different paths (admin→seed, reviewer→human).
_Avoid_: assuming admin ⊇ reviewer.

### Query intent & ranking

**Temporal Intent**:
The *eligibility-by-time* classification of a query — shapes the date WHERE-clause. Values: `current_validity` (a yes/no effectivity question), `current_applicability` (the default filter: effective & not expired), `as_of` (a user-specified point in time), `publication_period`, `historical_comparison`.
_Avoid_: treating it as a ranking concern; equating "a past year appears" with a historical query.

**Latest Intent**:
The *ranking-and-labeling* classification of a query — shapes ORDER BY + disclaimers, among already-eligible chunks. Values: `current_effective_policy` (default sort by effective_date), `latest_publication`, `latest_interpretation`, `rule_status`.
_Avoid_: conflating with Temporal Intent. The one interaction: `latest_publication` deliberately relaxes the default expiry filter (so it can surface a just-published or even expired doc) and **wins over** the default Temporal filter — but must then label effectivity status. Note the three "current_*" values live in different layers (question / filter / sort) and are **not** synonyms.

### Coverage & evidence

**Global Coverage Scope**:
A *static* declaration of which sources, date range and document types the KB *intends* to cover, plus per-source sync health. Background context only.
_Avoid_: ever using it to justify a non-existence claim; confusing it with what a given answer actually hit.

**Retrieval Coverage Evidence**:
A *per-query* record of what this answer actually hit — sources, date range, types, and which configured sources were absent from the results. Persisted on the Answer; the basis for "is there / latest" replies.
_Avoid_: inferring a source is missing/broken just because it's absent from one query's results.

**Evidence Sufficiency**:
The three-state gate — `NO_EVIDENCE` (return deterministic template, do not call the model) / `LIMITED_EVIDENCE` (model may only summarise provided material) / `SUFFICIENT_EVIDENCE` — deciding whether and how the model is invoked. Source sync health (stale/failed) adds a caveat sentence but never changes this state.
_Avoid_: treating a low similarity threshold alone as the gate.

### Answers & citations

**Answer**:
The persisted record of one model response to one question, with a lifecycle `GENERATING → COMPLETED | FAILED`. Only a `COMPLETED` Answer has an official `answer_text`.
_Avoid_: calling streaming text "the answer".

**Answer Draft**:
The transient visible text accumulated while `GENERATING` (the `draft_text` field). Never an official answer; UI must not present it as one. A field-level view of the Answer, not a separate entity.
_Avoid_: persisting it as a final answer; modelling it as its own table.

**Answer Generation Record**:
The generation provenance of an Answer — model, prompt-template version, coverage-evidence snapshot, timings — frozen at generation time. A conceptual view of fields on the Answer row, **not** a separate table in MVP.
_Avoid_: rebuilding it from current config after the fact.

**Citation Snapshot**:
The immutable, frozen-at-answer-time record of one cited chunk (文号, title, evidence excerpt, content hash, source location, answered-at). Historical fact; never re-rendered from live chunk content.
_Avoid_: editing it when the source later changes; conflating it with the `AnswerCitation` row that stores it.

**Citation Annotation**:
An *additive* post-hoc note on a citation (`source_withdrawn`, `content_error`, `source_removed`). The only way later events touch a citation — the snapshot itself stays frozen. When a source is withdrawn the snapshot **text** survives, but live access to the underlying **file** (download link) is suppressed.
_Avoid_: implementing post-hoc changes as snapshot edits.

**Citation Grounding Check**:
The pre-commit structural check (citation indices resolve, mentioned 文号 map to a snapshot) gating the COMPLETED transition. Structural only — no semantic/legal verification.
_Avoid_: claiming it validates correctness of the tax content.

**Standalone Query**:
The self-contained retrieval query rewritten from a multi-turn question, restoring only topic/time/jurisdiction the user already gave. Stored separately from the original question; if it can't be recovered reliably, the system asks for clarification rather than inventing facts.
_Avoid_: letting it add tax facts the user never stated.

### Permissions & audit

**Role**:
One of `viewer` (ask & read verified+retrievable material), `reviewer` (human-verify chunks), `admin` (manage seed corpus, withdraw/restore, hard-delete). **Composable and non-implying**: an actor needs `admin` *and* `reviewer` in their roles to do both — admin does not grant verify rights.
_Avoid_: assuming a role hierarchy where admin ⊇ reviewer ⊇ viewer.

**Remove Source**:
The restricted hard-delete of a Source Document and its source-only artifacts — admin-only, second-confirmation, reason required, blocked if unarchived historical citations exist, always audited. The exception, not the default; prefer Withdraw From Retrieval.
_Avoid_: cascading into Tax Authority Documents still supported by other sources; using it as the normal "remove" action.

**Audit Event**:
An append-only record of a consequential action (upload, verify, withdraw/restore, hard-delete attempt, seed add/remove, citation annotation) with actor, action, target, before/after state, reason. Written in the **same transaction** as the business change; never mutated.
_Avoid_: writing credentials, full prompts or PII into its payload.

## Example dialogue

> **Dev:** Someone uploaded 财税〔2023〕6号 twice — once from 税务总局官网, once from 财政部官网. Same 文号. One row or two?
> **Domain expert:** Two Source Documents. The 文号 is the same Tax Authority Document, but we don't model that as an entity — it's just matching metadata on two separate provenance records.
> **Dev:** So a Knowledge Chunk from the first upload can't be re-pointed to the second if we delete the first?
> **Domain expert:** Never. Each chunk stays bound to the Source Document that produced it. Identical content, identical 文号 — still parsed, verified and chunked independently.
