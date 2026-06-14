# AGENTS.md

Local rules for shared WebApp UI primitives.

## Scope

- Keep these components presentation-only. Do not import Prisma, call API routes, read cookies, or own domain state here.
- Components must be safe for Server Components unless they truly need browser state.
- Prefer small, stable public interfaces such as `variant`, `size`, `tone`, and shared className exports.

## Design Vocabulary

- Use the restrained product UI palette from `DESIGN.md`.
- Primary buttons are for the main action only.
- Status components must include visible text; color is supporting information, not the only signal.
- Keep controls consistent across QA, admin upload, document review, and history surfaces.
