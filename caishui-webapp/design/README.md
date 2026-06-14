# Design Asset Intake

This directory is the intake area for UI work before implementation.

## Folders

- `references/`: screenshots, URLs exported as PDFs/images, and notes for visual references the user provides.
- `figma-screens/`: page-level screenshots exported from Figma for implementation review.
- `notes/`: short design notes, prompt drafts, or decisions that are not source code.

Runtime-ready assets exported from Figma belong in `public/ui-assets/figma/`.

## Rules

- Do not place API keys, credentials, production data exports, or user PII in design assets.
- Keep source reference files named by page or workflow, for example `qa-main-reference.png`.
- Keep implementation assets small and explicit; avoid exporting whole Figma projects when a single icon or bitmap is enough.
- UI implementation should treat these files as inputs. Product behavior remains governed by `AGENTS.md`, `CONTEXT.md`, and `caishui-webapp-architecture_v2_1.md`.
