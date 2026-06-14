# Claude Design Prompts

These prompts define the visual direction for the Caishui tax knowledge-base web application. They are intended to be copied into Claude Design or Figma-oriented design generation tools.

## Global Visual Direction

```text
Design a clean Chinese tax knowledge-base web application UI with a soft light blue and white color palette, inspired by modern government technology platforms.

Visual style:
- Background: very light blue-white gradient, subtle misty blue shapes, soft layered waves, no strong dark blocks.
- Primary color: deep tax blue (#0077B6 / #006BA6).
- Secondary color: cyan teal (#2BB3C0 / #38B2AC).
- Accent color: soft green for verified and success states (#4CAF8F).
- Warning color: soft amber for limited evidence or review warnings.
- Error color: calm red for failed ingestion, failed retrieval, and rejected chunks.
- Text: near black for headings, slate gray for body text.
- Cards and panels: white or translucent white, subtle shadow, thin pale blue borders, 8px border radius.
- Layout: spacious, calm, credible, professional, information-first.
- Interaction style: precise buttons, compact tables, clear status badges, reliable admin-console behavior.

Product identity:
This is a Chinese tax and finance knowledge-base Q&A system for policy retrieval, source document ingestion, document review, citation-backed answers, and compliance-safe question answering.
The interface should feel trustworthy, precise, lightweight, and suitable for tax professionals, reviewers, and administrators.

Avoid:
- Purple gradients.
- Dark dashboards.
- Heavy shadows.
- Cartoon illustrations.
- Oversized marketing hero sections.
- Excessive glassmorphism.
- Highly rounded pill-heavy layouts.
```

## Main Q&A Page

```text
Create the main Q&A page for a Chinese tax knowledge-base assistant.

Page goal:
Users ask tax policy questions and receive citation-backed answers based on verified knowledge-base material.

Layout:
- Full viewport app shell with a soft light blue-white gradient background.
- Top navigation bar:
  - Logo on the left.
  - Navigation items: Q&A, Document Library, Upload Management, Review Center, System Status.
  - Primary CTA button on the right: New Question.
- Main content split into two columns:
  - Left: chat panel, large but calm, white translucent surface.
  - Right: citation and source panel showing retrieved policy sources.

Chat panel:
- Welcome title: "Tax Policy Knowledge Assistant"
- Subtitle: "Answers are generated from verified knowledge-base citations."
- User and assistant message bubbles.
- Assistant answers support citation markers such as [1], [2].
- Input box fixed at the bottom.
- Input placeholder: "Ask a tax policy question, for example: current applicable policy for R&D expense super deduction."
- Queue state, streaming state, no-evidence state, and retrieval-unavailable state must be visually distinct.

Source panel:
- Title: "Cited Sources"
- Each source item includes:
  - Document title.
  - Document number.
  - Official source.
  - Publish date.
  - Effective date.
  - Retrieval status.
  - Verification status.
- Show warning state for withdrawn sources, limited evidence, or stale source health.

Visual style:
Use soft white cards, pale blue borders, subtle shadows, deep blue buttons, cyan focus states, green verified badges, amber limited-evidence warnings, and red failure states.
Keep the typography compact enough for repeated professional use.
Do not make it look like a marketing landing page.
```

## Document Library Page

```text
Design a document library page for a Chinese tax knowledge-base system.

Purpose:
Admins and reviewers browse Source Documents and inspect processing, retrieval, and readiness status.

Layout:
- App shell with the same light blue-white background and top navigation.
- Page title: "Document Library"
- Toolbar:
  - Search input.
  - Document type filter.
  - Processing status filter.
  - Retrieval status filter.
  - Upload button.
- Main area:
  - Dense but elegant table, not card-heavy.

Table columns:
- Document Title
- Document Number
- Source
- Document Type
- Processing Status
- Retrieval Status
- Ready Chunks
- Uploaded At
- Actions

Status badges:
- COMPLETED: green.
- PROCESSING / PENDING: blue.
- FAILED: red.
- WITHDRAWN: gray or amber.
- RETRIEVABLE: green or blue.

Behavioral states:
- Row hover should be subtle pale blue.
- Failed rows should show a visible failure reason hint.
- Withdrawn rows should remain visible for audit, but visually muted.

Visual style:
Professional SaaS/admin table, light blue surface, white table container, thin dividers, compact spacing, precise status colors, no oversized decorative cards.
```

## Document Detail And Chunk Review Page

```text
Design a document detail and chunk review page for a Chinese tax knowledge-base system.

Purpose:
A reviewer checks parsed chunks, verifies or rejects chunks, retries embedding jobs, and sees retrieval readiness.

Layout:
- Header section:
  - Document title.
  - Document number.
  - Publish date.
  - Effective date.
  - Processing status.
  - Retrieval status.
  - Actions: Withdraw From Retrieval, Restore Retrieval, Hard Delete.
- Lifecycle summary panel:
  - Ready chunk count.
  - Blocked chunk count.
  - Unverified chunk count.
  - Clear warning if source is withdrawn or failed.
- Main area:
  - Paginated chunk review list.
  - Pagination controls above and below the chunk list.

Chunk item:
- Compact white card with:
  - Chunk index.
  - Chunk type.
  - Verification status.
  - Embedding status.
  - Retrieval readiness.
  - Effective date.
  - Expiry date.
  - Content preview.
  - Content hash preview.
  - Review notes if present.
- Actions:
  - Verify.
  - Reject.
  - Retry Embedding.

Important behavior:
- Verified chunks are only retrieval-ready when embedding is completed and retrieval status is retrievable.
- Withdrawn chunks should not show retry embedding actions.
- Human verification can succeed while embedding trigger fails; show this as a warning instead of rolling back verification.
- Large documents must be shown with pagination. Do not design a page that assumes all chunks are loaded at once.

Visual style:
Light blue-white background, white cards with subtle border, dense admin workflow, precise status badges.
This should feel like a professional review console, not a marketing page.
```

## Upload Management Page

```text
Design an upload management page for a Chinese tax knowledge-base system.

Purpose:
An admin uploads source documents, previews parsed chunks, and starts ingestion.

Layout:
- Page title: "Upload Source Document"
- Left panel:
  - Drag-and-drop upload area.
  - Fields:
    - Source channel.
    - Document type.
    - Title.
    - Document number, optional.
  - Buttons:
    - Preview Chunks.
    - Start Ingestion.
- Right panel:
  - Preview result area.
  - Shows preview ID, detected metadata, chunk count, and warnings.
  - List of preview chunks with:
    - Chunk type.
    - Content snippet.
    - Effective date.
    - Expiry date.
    - Verification state.
- Below:
  - Recent upload table with:
    - Processing status.
    - Retrieval status.
    - Failure reason.
    - Detail link.

States:
- Empty upload.
- Preview loading.
- Preview success.
- Pipeline unavailable error.
- Ingestion accepted.
- Ingestion failed.

Visual style:
Soft light blue background, white translucent panels, deep blue primary button, cyan focus outlines, green success, amber warning, red error.
```

## System Status And Acceptance Dashboard

```text
Design a system status and local acceptance dashboard for a Chinese tax knowledge-base web application.

Purpose:
A developer or admin checks readiness of WebApp, data-pipeline, PostgreSQL, provider connectivity, and release checks.

Layout:
- Page title: "System Acceptance Status"
- Top summary strip:
  - WebApp.
  - Data Pipeline.
  - PostgreSQL.
  - Embedding Provider.
  - DeepSeek Chat.
- Each item has status:
  - ready.
  - blocked.
  - failed.
  - skipped.
- Main content:
  - Acceptance checklist timeline:
    1. Migration contract.
    2. Contract parity.
    3. Typecheck.
    4. WebApp tests.
    5. Local build.
    6. Release readiness.
    7. Live E2E smoke.
    8. Provider smoke.
- Right side:
  - Environment warnings.
  - Missing environment variables.
  - Last run output summary.
  - Short command snippets.

Visual style:
Clean technical operations UI, pale blue-white background, crisp status badges, code-like command snippets in light gray boxes.
Use compact cards, not large decorative hero sections.
```

## Empty And Error States

```text
Create reusable empty and error states for the Chinese tax knowledge-base app.

States needed:

1. No evidence found
Primary text:
"No verified knowledge-base evidence was retrieved for this question."
Secondary text:
"This does not mean the policy does not exist. Please verify with official sources."

2. Limited evidence
Primary text:
"Limited evidence"
Secondary text:
"The answer is based only on the retrieved verified material and may be incomplete."

3. Pipeline unavailable
Primary text:
"Data pipeline is temporarily unavailable"
Secondary text:
"Please check the data-pipeline service status and try again."

4. Source withdrawn
Primary text:
"This cited source has been withdrawn from the current knowledge base"
Secondary text:
"The historical citation snapshot is preserved for audit only."

5. Upload failed
Primary text:
"Document ingestion failed"
Secondary text:
"Show the failure reason and provide a link to the failed source document."

Visual style:
No cartoons. Use calm line icons, pale blue panels, amber or red status accents, and a professional compliance tone.
```

## Global Constraints To Append To Every Prompt

```text
Important constraints:
- This is an operational product UI, not a marketing landing page.
- Use Chinese labels in the actual interface, even though this prompt is written in English.
- Keep layout practical for repeated professional use.
- Do not put domain logic explanations as visible tutorial text.
- Use compact tables, clear status badges, precise action buttons, and restrained panels.
- Preserve the color language: light blue-white background, deep tax blue primary actions, cyan focus states, green verified states, amber warnings, red failures.
- Avoid dark dashboards, purple gradients, cartoon illustrations, excessive glassmorphism, oversized hero sections, and decorative card-heavy layouts.
- Preserve existing application behavior: citations, evidence sufficiency, source withdrawal, chunk verification, embedding readiness, and audit states must remain visible where relevant.
```

