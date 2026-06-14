# AGENTS.md

Local rules for Design Asset Intake.

## Folders

- `design/references/` — user-provided reference screenshots, links, or page notes.
- `design/figma-screens/` — Figma page-level exports.
- `design/notes/` — prompt drafts, design notes, and mapping notes.
- `public/ui-assets/figma/` — runtime-ready exported assets used by the app.

## Rules

- Do not store credentials, API keys, private customer data, or PII in design assets.
- Use explicit filenames that identify screen, state, and date when useful.
- Treat reference pages as inputs, not implementation truth. Existing WebApp Module rules still decide state, data, and error behavior.
- Runtime assets belong under `public/ui-assets/figma/`; raw references stay under `design/`.
- When implementing UI from Figma, preserve existing deep Modules and presenters instead of moving domain logic into JSX.
