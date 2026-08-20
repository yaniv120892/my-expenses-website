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
npm test                 # vitest unit tests (src/**/*.test.{ts,tsx})
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
here are pure functions, not components.

## Architecture

- `src/app/` — App Router. `(auth)/` login/signup/verify; `(app)/` the 8
  authenticated pages (dashboard, transactions, pending, scheduled,
  subscriptions, imports, trends, settings) inside the AppShell drawer layout.
- `src/app/api/**/route.ts` — all API endpoints. Most are built with
  `createHandler` (`src/server/http/handler.ts`) which resolves auth
  (`session` | `cron` | `telegram` | `public`), zod-validates body/query,
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
  outside a route handler.
- **Error tracking**: Sentry, inert unless `NEXT_PUBLIC_SENTRY_DSN` is set.
  `sentry.config.ts` holds the single `Sentry.init`; `instrumentation.ts` runs
  it for the Node and edge runtimes and `src/instrumentation-client.ts` for the
  browser. `onRequestError` logs _and_ reports; the React boundaries report via
  `src/components/ErrorFallback.tsx`. Tracing and Session Replay are off — the
  free tier budgets errors only.
- Comments only where code cannot explain itself, 1–2 sentences max.

## Database (Prisma)

Models: User, Transaction, Category (hierarchical), ScheduledTransaction,
Import/ImportedTransaction, TransactionFile, UserCategoryMapping,
AutoApproveRule, DetectedSubscription, UserNotificationPreference/Provider.
Mastra keeps its own tables in the `mastra` Postgres schema (not Prisma-managed).

## Crons (vercel.json)

| Path                                | Schedule      |
| ----------------------------------- | ------------- |
| /api/scheduled-transactions/process | 07:00 daily   |
| /api/summary/today                  | 21:00 daily   |
| /api/backup/transactions            | 03:00 daily   |
| /api/subscriptions/detect           | 04:00 Mondays |
| /api/subscriptions/audit-notify     | 08:00 Mondays |

## Deployment

Vercel. `vercel-build` runs `prisma generate && prisma migrate deploy && next build`.
Set all env vars from `.env.example`; `CRON_SECRET` must be set or scheduled
jobs 401. The Telegram webhook must be registered with
`setWebhook(url=${WEBSITE_URL}/api/webhook, secret_token=${TELEGRAM_WEBHOOK_SECRET})`.
