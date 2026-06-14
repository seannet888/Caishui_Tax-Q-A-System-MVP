# Identity trust boundary is opt-in; roles are non-implying

## Trust boundary

The app **never** trusts `X-User-ID` / `X-User-Roles` headers by default. Header-trust is an explicit opt-in via `TRUST_PROXY_AUTH=true`, set only when deployed behind a vetted internal reverse proxy that strips client-supplied copies of those headers. When the flag is off (the default, and all local development), identity comes from `MVP_ACTOR_ID` / `MVP_ACTOR_ROLES` and any incoming `X-User-*` header is ignored.

## Roles

`viewer | reviewer | admin` are **composable and non-implying**. `admin` (manage seed corpus, withdraw/restore, hard-delete) does **not** grant `reviewer` (human-verify). An actor that needs both must hold both roles explicitly; each permission check verifies its own role.

## Why

- **Safe default:** the original code read the headers unconditionally, so a directly-exposed or misconfigured deployment would let any client send `X-User-Roles: admin` and impersonate an admin (confused deputy → withdraw/hard-delete). Making trust opt-in means the dangerous configuration cannot happen by omission.
- **Separation of duties:** human verification carries professional judgement and audit responsibility; it must not ride along with infrastructure-admin rights.

## Consequences

- Do not "simplify" `requireRole(actor, 'reviewer')` to also pass for admins, and do not remove the `TRUST_PROXY_AUTH` gate to "just read the header." Both reintroduce the exact holes this records.
- Optional defense-in-depth: also require a proxy-injected shared-secret header when `TRUST_PROXY_AUTH` is on.
