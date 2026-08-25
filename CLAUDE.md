# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Single Next.js 15 (App Router) application serving both the frontend and the backend of an expense management system with AI-powered categorization and a chat assistant. Formerly split across `my-expenses` (Express API, now deprecated) and this repo.

Two sibling services stay external and are reached over HTTP: `expense-categorizer` (FastAPI/FastText, `POST /predict`) and `excel-extraction-service` (Express + Gemini, async webhook callbacks).

## Commands

```bash
npm run dev              # Next.js dev server with Turbopack (port 3000)
npm run build            # prisma generate && next build
npm run typecheck        # tsc --noEmit
npm run lint             # eslint .
npm run format           # prettier --write .
npm run db:migrate       # prisma migrate deploy (uses DIRECT_URL)
npm test                 # vitest unit + type tests (*.test.{ts,tsx}, *.test-d.ts)
npm run test:types       # vitest type tests only (src/**/*.test-d.ts)
npm run test:e2e:api     # API/chat harness (see test/e2e-api/README.md)
npm run test:e2e:ui      # Playwright specs in e2e/
```

Pre-commit runs lint-staged + typecheck (husky). CI
(`.github/workflows/ci.yml`) runs lint + typecheck + unit tests, and both
e2e suites against `npx prisma dev` as the local Prisma Postgres.

Vitest runs on `node` by default; a component or hook test opts into a DOM
with a `// @vitest-environment jsdom` docblock and renders through
`src/test/renderWithClient.tsx` (React Testing Library + a QueryClient). Keep
logic that can be tested without a DOM in a plain `.ts` module — most suites
here are pure functions, not components. Type-level assertions live in
`*.test-d.ts` files and are checked by tsc via `test.typecheck` in
`vitest.config.ts`, so they run as part of `npm test`; `npm run test:types`
runs them alone.

## Architecture

- `src/app/` — App Router. `(auth)/` login/signup/verify; `(app)/` the 8
  authenticated pages (dashboard, transactions, pending, scheduled,
  subscriptions, imports, trends, settings) inside the AppShell drawer layout.
- `src/app/api/**/route.ts` — all API endpoints. Most are built with
  `createHandler` (`src/server/http/handler.ts`) which resolves auth
  (`session` | `cron` | `telegram` | `public`), zod-validates body/query,
  validates dynamic route params as uuids by default (a route with a
  non-uuid segment must declare its own `paramsSchema`),
  enforces per-route rate limits (`src/server/http/rateLimit.ts`; required
  on `public` routes — declare rules or an explicit `'none'`),
  maps errors to `{message}`/`{error, code}`, and logs one pino line per
  request. Special routes: `/api/chat` (SSE streaming), `/api/webhook`
  (Telegram, secret-token header), `/api/excel-extraction-agent/webhook`
  (HMAC in query params over `userId:timestamp:importId`, so a callback is
  bound to the import it was submitted for), `/api/auth/*` (cookie handling).
- `src/server/` — backend logic: `services/` (business logic; singletons),
  `repositories/` (Prisma),
  `services/assistant/` (Mastra agent, tools, PG-backed memory),
  `auth/` (jose JWT + Upstash Redis sessions + httpOnly cookie),
  `integrations` live inside services as `lazy()` fields.
- `src/shared/` — zod request schemas (`schemas/`, inferred types shared by
  routes and client) and domain types (`types/`).
- `src/components/`, `src/hooks/` (TanStack Query v5, query-key factories),
  `src/services/` (thin axios client, SSE chat client), `src/utils/` (pure
  helpers — components and hooks import from here, never the reverse),
  `src/test/` (test-only render helpers), `src/theme/` (MUI CSS-vars theme,
  light+dark, `palette.charts` for recharts colors).
- Server state that changes without the client acting — extraction webhooks
  are the only case today — is observed by polling: `useImportsQuery` sets a
  `refetchInterval` while any import is in flight and `false` otherwise (see
  `src/utils/importStatus.ts`), overriding the global 60s `staleTime`.
- `src/middleware.ts` — page-level auth (verifies the `session` cookie JWT,
  redirects), plus an Origin check on non-GET `/api/*`.
- `next.config.ts` — security response headers on every route via `headers()`
  (`frame-ancestors 'none'` + `X-Frame-Options`, nosniff, referrer,
  permissions) and `poweredByHeader: false`; not middleware, whose matcher
  skips static assets.

## Key invariants

- **No module-load-time construction of network clients.** Every external
  client (OpenAI, Gemini, Telegram, SMTP, S3, Google, excel extraction) is
  built through `lazy()` from `src/server/lib/lazy.ts` and reads env via
  `requireEnv`. A missing env var must fail the call, never the import.
- **Auth**: JWT (jose HS256, 7d) in an httpOnly `session` cookie; Redis key
  `session:<userId>:<token>` must exist (logout deletes it). API routes also
  accept `Authorization: Bearer` (scripts/e2e). Cron routes require
  `Authorization: Bearer ${CRON_SECRET}`; Vercel sends it automatically.
- **Prisma**: schema + migrations in `prisma/`; app client is
  `@prisma/client/edge` + field-encryption + Accelerate (DATABASE_URL must be
  a `prisma://` URL; DIRECT_URL is plain Postgres for migrations, the seed,
  and Mastra's memory store).
- **Styling**: MUI `sx` + theme tokens only — no inline `style=`, no CSS
  custom properties, no global utility classes, no hardcoded hex in
  components (charts read `theme.palette.charts`).
- **Logging**: pino (`src/server/logging/logger.ts`), metadata object first:
  `logger.info({ userId }, 'msg')`; errors under the `err` key. Vercel keeps
  runtime logs for an hour, so anything swallowed is invisible soon after.
  `createHandler` logs every 5xx; `instrumentation.ts` logs errors Next raises
  outside a route handler. Outside development, warn and above is also shipped
  to Better Stack through `pino.multistream` (never a pino transport — its
  worker threads are unreliable on Vercel) and flushed in one batched POST per
  request from a `next/server` `after` hook. Unset
  `BETTERSTACK_SOURCE_URL`/`_TOKEN` means shipping is off, not an error. See
  README "Log shipping".
- **Error tracking**: Sentry, inert unless `NEXT_PUBLIC_SENTRY_DSN` is set.
  Logs say what happened; Sentry groups and counts it, and outlives the hour.
  `sentry.config.ts` holds the single `Sentry.init`; `instrumentation.ts` runs
  it for the Node and edge runtimes and `src/instrumentation-client.ts` for the
  browser. `initSentry` takes no arguments and reads every value from
  `process.env` itself: a parameter whose argument constant-folds gets inlined
  into an unbound `{environment}` shorthand that throws in the browser bundle.
  `createHandler` reports every 5xx it turns into a response — Next's
  `onRequestError` cannot see those, because the error never escapes the route.
  `onRequestError` covers what does escape, and the React boundaries report via
  `src/components/ErrorFallback.tsx`, skipping errors carrying a `digest` since
  the server already reported those. A `logger.error` in a path that swallows
  its error reports alongside the log, or Sentry never learns of it. Tracing and
  Session Replay are off — the free tier budgets errors only.
- Comments only where code cannot explain itself, 1–2 sentences max.

## Database (Prisma)

Models: User, Transaction, Category (hierarchical), ScheduledTransaction,
Import/ImportedTransaction, TransactionFile, UserCategoryMapping,
AutoApproveRule, DetectedSubscription, UserNotificationPreference/Provider.
Mastra keeps its own tables in the `mastra` Postgres schema (not Prisma-managed).

## Crons (vercel.json)

| Path                                | Schedule         |
| ----------------------------------- | ---------------- |
| /api/scheduled-transactions/process | 07:00 daily      |
| /api/summary/today                  | 21:00 daily      |
| /api/backup/transactions            | 03:00 daily      |
| /api/subscriptions/detect           | 04:00 Mondays    |
| /api/subscriptions/audit-notify     | 08:00 Mondays    |
| /api/reports/monthly                | 06:00 on the 1st |

Each cron route passes its `heartbeatEnvVar` to `createHandler`, which pings
that Better Stack URL after a <400 response (unset var = off). `HandlerOptions`
is a union discriminated on `auth`, so `heartbeatEnvVar` exists only on the
`auth: 'cron'` arm — a non-cron route declaring one is a compile error. See
README "Cron heartbeats".

## Deployment

Vercel. `vercel-build` runs `prisma generate && prisma migrate deploy && next build`.
Set all env vars from `.env.example`; `CRON_SECRET` must be set or scheduled
jobs 401. The Telegram webhook must be registered with
`setWebhook(url=${WEBSITE_URL}/api/webhook, secret_token=${TELEGRAM_WEBHOOK_SECRET})`.

## Documentation

This file is the only design document. Per-feature plans, specs, and handover
notes are not committed — `.superpowers/`, `docs/superpowers/`, and
`.claude/worktrees/` are gitignored, while `.claude/skills/` and
`.claude/rules/` stay tracked because they are tooling, not scratch. Agent
output stays in the ignored directories or in the session. A spec that
describes work already shipped is worse than no spec: it drifts, and readers
cannot tell it from current intent.

`.claude/rules/` holds the craft rules — comments, control flow, naming, error
handling, typing, env wiring, secret handling — vendored from
`yaniv120892/claude-config` so they load without that repo's `install.sh`,
which only reaches `~/.claude` on one machine. Each file carries a `paths:`
list and loads only when a file it governs is read. This file stays the place
for what is true of _this_ system; `.claude/rules/` is how code gets written
anywhere. Edit a rule upstream first, then re-vendor. The mechanically
checkable ones (`curly`, `array-type`, `explicit-member-accessibility`) are
enforced in `eslint.config.mjs`, so CI fails on them rather than review.

So a PR that changes anything this file states — architecture, an invariant, a
command, a route, a cron, a model — updates the matching section in the same
PR. Record the rule the code now follows, not the story of the change; git log
already holds that. If a change fits no existing section and is not a rule
future work must follow, it does not belong here.
