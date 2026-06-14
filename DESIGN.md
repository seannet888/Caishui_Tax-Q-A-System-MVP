# Design

## Foundation

This product uses a restrained light workspace inspired by the Claude Design reference imported on 2026-06-14. The visual goal is a calm tax research console, not a landing page.

## Color

- Background: pale blue gradient from `#F2F8FD` to `#EAF4FB` to `#F4FAFE`.
- Ink: `#0F2A3C`.
- Muted text: `#5B7387`.
- Primary action: `#0077B6`, with dark state `#006BA6` and hover `#0087CF`.
- Secondary accent: `#2BB3C0`.
- Success: `#4CAF8F` / `#EAF7F2`.
- Warning: `#A47B2A` / `#FBF4E2`.
- Danger: `#A82E33` / `#FCEDED`.
- Borders and dividers: `#DCEAF4` and `#EDF4F9`.

## Typography

Use one product UI stack: `Noto Sans SC`, `PingFang SC`, `Microsoft YaHei`, system sans-serif. Keep type sizes fixed and practical; do not use fluid display typography inside product surfaces.

## Components

- App shell: persistent top navigation plus left product navigation on desktop.
- Panels: white or lightly translucent surfaces with 8-12px radius, subtle border, and minimal shadow.
- Buttons: primary blue for the main action only; secondary actions use white surface and blue text.
- Inputs: white surface, blue focus ring, readable placeholder contrast.
- Status: use both label text and background color. Do not rely on color alone.

## Layout

QA is the primary work surface. It should show a clear question input, assistant/user message rhythm, and citation evidence without moving retrieval or state-machine logic into JSX.

## Motion

Use short 150-200ms transitions for hover/focus/state feedback only. Disable transitions for users who prefer reduced motion.
