# Claude Tax UI Intake Report

Source archive:

- `C:\Users\Administrator\Downloads\税收咨询应用 (1).zip`

Extracted reference folder:

- `design/imports/claude-tax-ui-20260614/`

## Contents

| File | Role | Integration status |
| --- | --- | --- |
| `税务知识库.dc.html` | Claude Design single-file prototype with inline layout, styles, and demo state | Visual reference only |
| `support.js` | Claude Design runtime for `.dc.html` templates | Do not ship |
| `screenshots/qa-answered.png` | QA answered state screenshot | Reference image |
| `screenshots/qa-final.png` | QA input/final state screenshot | Reference image |
| `screenshots/qa-fixed.png` | QA answer + citation state screenshot | Reference image |
| `screenshots/qa-focus.png` | Focused QA layout screenshot | Reference image |
| `uploads/claude-design-prompts.md` | Original design prompts | Keep as design source |

## Summary

The archive is useful as a design reference, not as implementation source.

The generated `.dc.html` contains a complete mocked product shell with QA, document library, review, upload, and system-status screens. It uses Claude Design template tags such as `sc-if` and `sc-for`, inline styles, demo-only state, and a custom `support.js` runtime. This runtime loads React UMD, fetches sibling design files, and uses dynamic function execution. It must not be copied into the Next.js app.

## What To Reuse

- QA visual rhythm: assistant header, right citation rail, blue user bubble, white assistant answer card.
- Evidence states: queue, streaming, limited evidence, no evidence, retrieval unavailable.
- Citation card vocabulary: document number, source, publish/effective dates, retrievable/verified badges.
- Compact admin tables and review cards from the prototype sections.
- Color direction already matches `DESIGN.md`: pale blue background, deep tax blue, cyan focus, green verified, amber warning, red failure.

## What Not To Reuse Directly

- `support.js`
- `<x-dc>`, `<sc-if>`, `<sc-for>`, `style-hover`, `style-focus`, and `onClick="{{ ... }}"`
- Inline demo state from `class Component extends DCLogic`
- Mocked navigation state and mocked QA answer data
- Runtime-loaded Google Fonts link from the prototype HTML
- Any dynamic evaluation or sibling fetch behavior from the Claude runtime

## Integration Rules

- Preserve existing Next.js route and module boundaries.
- Keep QA state in `app/qa/components/qa-page-view-model.ts`, `chat-sse-protocol.ts`, and `history-hydration.ts`.
- Keep document lifecycle and chunk readiness rules in existing presenters.
- Use `components/ui/*` primitives instead of importing raw inline styles.
- Add tests before each integration slice.
- Verify each changed screen with desktop and mobile browser checks.

## Recommended TDD Slices

1. **QA Citation Rail Polish**
   - Add/extend presenter test for cited source card display.
   - Update `SourcePanel.tsx` to follow the Claude reference card density and status badge layout.

2. **QA Message Rhythm Polish**
   - Add/extend display presenter tests for no evidence, limited evidence, streaming, and failed states.
   - Update `MessageBubble.tsx` spacing and answer/citation marker treatment.

3. **QA Input Bar Polish**
   - Add/extend component render tests for suggested question chips and disabled state.
   - Update `QueryInput.tsx` and shared `Button`/`FormField` primitives if needed.

4. **Document Library Table Polish**
   - Extend `DocTable` tests around failed and withdrawn rows.
   - Apply compact table spacing, row hover, muted withdrawn row styling, and failure reason hint.

5. **Upload Management Polish**
   - Extend upload UI tests around preview/loading/failure visibility where possible.
   - Use the two-panel upload/preview layout from the reference without moving upload logic out of `UploadForm.tsx`.

6. **Document Detail / Chunk Review Polish**
   - Extend presenter tests for readiness labels and action availability.
   - Apply reference-style lifecycle summary and chunk cards while preserving paginated `loadDocumentReview`.

## Current Verdict

Adopt the visual direction. Do not adopt the generated runtime or raw HTML. Treat this import as a reference asset set for incremental, tested UI work.
