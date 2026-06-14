# Citation Snapshots are immutable; later events are additive annotations

A Citation Snapshot is frozen at answer time and never re-rendered from live chunk content. Anything that happens to a source afterwards — withdrawal, a content-error flag, removal — is recorded as an *additive* **Citation Annotation**, never as an edit to the snapshot. A reopened historical answer therefore shows the exact evidence excerpt, 文号 and content hash that grounded it when it was generated.

## The deliberate asymmetry

When a Source Document is withdrawn, the citation's snapshot **text survives** (it is historical fact), but **live access to the underlying file** (the public download link) is **suppressed**. Frozen quote stays; live file access is a current permission, not part of the frozen record.

## Why

Answers are decision inputs in a regulated domain; a user must be able to see what an answer was based on at the time, even after the knowledge base changes. Re-rendering from current chunk content would rewrite history and destroy traceability.

## Consequences

- Do **not** join `AnswerCitation` to live `KnowledgeChunk` content for display — render from the snapshot.
- Post-hoc UI states (withdrawn / content-error) come from `CitationAnnotation` rows, layered over the unchanged snapshot.
- "Answer Generation Record" and "Answer Draft" stay as views of fields on the `Answer` row — no separate tables in MVP.
