# API routes

Load before adding or changing a route under `src/app/api/`, `createHandler`, rate limits,
`src/proxy.ts` or the security headers in `next.config.ts`.

## `createHandler`

All API endpoints live in `src/app/api/**/route.ts`. Most are built with `createHandler`
(`src/server/http/handler.ts`), which:

- resolves auth (`session` | `apiToken` | `cron` | `telegram` | `public`) →
  [auth-and-api-tokens.md](auth-and-api-tokens.md), before changing who may call a route;
- zod-validates body/query;
- validates dynamic route params as uuids by default through `recordIdSchema` (a route with a
  non-uuid segment must declare its own `paramsSchema`);
- enforces per-route rate limits (`src/server/http/rateLimit.ts`; required on `public` routes —
  declare rules or an explicit `'none'`);
- sets the actor for attribution and calls the household write guard before any non-GET member
  handler →
  [households.md](households.md), before adding a write route;
- maps errors to `{message}`/`{error, message, code}` (or a JSON-RPC error envelope on a route declaring
  `errorFormat: 'json-rpc'`), and logs one pino line per request. Every error it maps to a 5xx is
  also reported to Sentry and alerted to the Telegram ops chat (README "Alerting (Telegram)").

## A uuid-checked id goes through `recordIdSchema`

`recordIdSchema` (`src/shared/schemas/common.ts`) checks route params, request schemas and MCP
tool schemas alike. It checks the uuid shape only, since the categories the first migrations
seeded carry ids without the RFC 9562 version and variant bits that `z.uuid()` requires.

## Special routes

- `/api/chat` — SSE streaming.
- `/api/mcp` — the personal agent's MCP server → [personal-agent-mcp.md](personal-agent-mcp.md),
  before changing it or a tool.
- `/api/webhook` — Telegram, secret-token header; the bot only sends, except that `/start <code>`
  binds the chat it arrives from to the user who issued the code → [telegram.md](telegram.md),
  before changing chat linking.
- `/api/excel-extraction-agent/webhook` — HMAC in query params over `userId:timestamp:importId`,
  so a callback is bound to the import it was submitted for →
  [import-lifecycle.md](import-lifecycle.md), before changing the callback.
- `/api/imports/[importId]/reconciliation-preview` (GET) — what approving the import would do,
  writing nothing → [import-matching.md](import-matching.md), before changing its hints.
- `/api/imports/[importId]` (GET) — one import with its pending count and, when merged, the
  import it merged into.
- `/api/auth/*` — cookie handling.
- `/api/health` — liveness only; touches no dependency, so Neon can scale to zero.
- `/api/health/deep` — polled at most hourly; each instance reuses its last outcome, failures
  included, for 60s and runs one check for concurrent misses, so a caller polling it reaches the
  database at most once a minute per instance.

## Proxy and headers

- `src/proxy.ts` — page-level auth (verifies the `session` cookie JWT, redirects), plus an Origin
  check on non-GET `/api/*`.
- `next.config.ts` — security response headers on every route via `headers()`
  (`frame-ancestors 'none'` + `X-Frame-Options`, nosniff, referrer, permissions) and
  `poweredByHeader: false`; not the proxy, whose matcher skips static assets.
