# MVP never asserts a regulation's non-existence from a retrieval miss

A retrieval miss is never evidence that a regulation does not exist or has not been issued. In the MVP the system **never synthesizes** a "未出台 / 还未发布 / 不存在" claim — not from zero results, not from a fresh `Global Coverage Scope`, not from healthy source sync. `NO_EVIDENCE` returns the deterministic template ("可能已发布但未被收录，建议核实"). The *only* way a non-existence statement reaches the user is by quoting an official source that itself states non-existence, explicitly attributed as such.

## Why

In tax/finance, falsely telling a user a relief or follow-up measure "hasn't been issued" causes them to act on wrong information. Absence of evidence in a knowledge base that does not claim full coverage is not evidence of absence.

## Consequences

- The three coverage/evidence constructs have strict, non-interchangeable roles: **Global Coverage Scope** (static intent) and **Retrieval Coverage Evidence** (per-query actuals) are background/transparency; neither justifies a non-existence claim.
- Source sync health (`stale`/`failed`) only appends a caveat sentence; it never moves the Evidence Sufficiency state.
- A future version *might* introduce a bounded "as far as our records go, not found" claim, but only behind explicit, calibrated coverage guarantees — it is deliberately absent now. Anyone tempted to add "not found → not issued" should read this first.
