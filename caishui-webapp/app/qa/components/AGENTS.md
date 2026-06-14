# AGENTS.md

Local rules for the QA page UI Modules.

## Owning Modules

- `chat-sse-protocol.ts` owns browser-side SSE protocol parsing.
- `qa-client-session.ts` owns browser-side conversation identity, history hydration, `/api/chat` request construction, SSE consumption, busy/ready state, and latest citation state.
- `qa-page-view-model.ts` owns QA page message state projection: queued user turns, conversation history trimming, `ChatStreamEvent` application, and transport failure fallback.
- `answer-display-presenter.ts` owns user-facing assistant answer display projection for historical answers and stream errors.
- `history-hydration.ts` owns safe hydration behavior.
- `conversation-identity.ts` owns browser-side conversation identity persistence.
- `ChatWindow.tsx` should render the QA experience and call the `qa-client-session.ts` Interface. It should not fetch `/api/chat`, consume SSE events directly, parse SSE frames, or reimplement message transition rules.

## Hydration and Streaming

- Treat async hydration as stale unless current UI state is still empty or explicitly mergeable.
- Use functional state updates when applying async results that can race with user actions or SSE events.
- Preserve in-flight user messages and streaming assistant drafts over late-arriving history snapshots.
- Replacement with hydrated history is allowed only during initial empty-state hydration.
- Do not call `setMessages(hydratedMessages)` from an async effect after mount unless it checks current state.
- History read models must not mutate active generation state.
- `/api/chat` request history must include user messages and completed assistant answers only. Do not send failed audit records, queued placeholders, streaming drafts, or unstated assistant messages into retrieval/standalone-query context.
- Browser-generated `conversationId` is MVP/local identity only. Do not treat it as authorization; production multi-user deployment must add server-side conversation ownership checks.

## User-Facing Errors

- Never show raw provider errors, stack traces, grounding internals, or raw `error_code` values directly to end users.
- `answer-display-presenter.ts` maps failed Answer/error codes to safe text.
- Retrieval readiness failures should render as a safe retrieval-unavailable message.

## SSE Protocol

- Do not parse `data:` frames, manage text decoder buffers, or call `JSON.parse` on SSE payloads directly in `ChatWindow.tsx`.
- Add protocol tests when adding a new stream event shape.
