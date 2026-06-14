# Source Document is a provenance record, not a legal authority

The core uploaded entity is modelled as a **Source Document** = one uploaded file from one source channel (hash, size, path + provenance). The legal authority it expresses — 文号, effective/expire dates, 效力层级 — lives as **metadata fields on the Source Document**, not as its own entity. We deliberately do **not** model `TaxAuthorityDocument` / `AuthorityTextVersion` / `AuthorityProvision` in the MVP.

## Consequences

- Two byte-identical uploads of the same 文号 from different channels are **two** Source Documents, not one. Their authority metadata may match, but they are never merged into a shared legal entity.
- Every Knowledge Chunk is permanently bound to the Source Document that produced it. Even on deletion of one source, a chunk is never re-pointed to another Source Document carrying the same content/文号 (the Chunk Provenance rule).
- Cross-source de-duplication, version graphs, and supersession chains are out of scope until a future version reintroduces a legal-authority entity. Adding it later means a new entity + explicit equivalence relations — not rewriting `document_id`.
- The Prisma model is named `SourceDocument` (`@@map("source_documents")`) so code matches the audit `target_type` and the domain language. The foreign key stays `document_id` to avoid mass churn.
