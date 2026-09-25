# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Single Next.js 15 (App Router) application serving both the frontend and the backend of an expense management system with AI-powered categorization and a chat assistant.

One sibling service stays external and is reached over HTTP: `excel-extraction-service` (Express + Gemini, async webhook callbacks). Transaction categories come from a user's own description mapping first, then the AI provider.

## Commands

```bash
npm run dev              # Next.js dev server with Turbopack (port 3000)
npm run dev:local        # whole local stack in one command (see below)
npm run build            # prisma generate && next build
npm run typecheck        # tsc --noEmit
npm run lint             # eslint .
npm run format           # prettier --write .
npm run db:migrate       # prisma migrate deploy (uses DIRECT_URL)
npm test                 # vitest unit + type tests (*.test.{ts,tsx}, *.test-d.ts)
npm run test:types       # vitest type tests only (src/**/*.test-d.ts)
npm run test:e2e:api     # API/chat harness (see test/e2e-api/README.md)
npm run test:e2e:ui      # Playwright specs in e2e/
npm run statements:import -- <dir> [--dry-run] [--resubmit] [--base-url=<url>]   # bulk import + reconcile
npm run categories:compare -- [--samples=<json>] [--out=<json>] [--only=jev|llm] [--repeat=<n>]  # Jev vs LLM categorization benchmark
```

Pre-commit runs lint-staged + typecheck (husky). CI (`.github/workflows/ci.yml`)
runs audit, lint, prettier, typecheck, unit tests and the build, and in a
parallel job both e2e suites against `npx prisma dev`.

`.github/workflows/deps-upgrade.yml` runs daily and opens one `deps/<slug>-<version>`
pull request per outdated package, a lockstep family (`LOCKSTEP_FAMILIES` in
claude-config's `deps-discover` action) or a package and its `@types` counting
as one. The jobs live in `yaniv120892/claude-config`; this file only repeats the
`checks` job's commands, so the two lists change together. A bump that fails one
opens its PR as a draft. The flow only opens PRs; merging stays with a human.

`npm run dev:local` (`scripts/dev-local.sh`) is the supported way to run the
app: database, migrations, mock services, and the dev server, blocking until
`/api/health/deep` is green. Its env block mirrors the `env:` block of CI's e2e
job — change both together. It restarts `prisma dev` each run, because that
server's pooler hands `migrate deploy` the previous run's session and it dies
on an already-prepared statement.

Presetting `DATABASE_URL` and `DIRECT_URL` (plus `REMOTE_DATABASE_OK=1` and
`SESSION_USER_EMAIL`) runs the same stack over that database with no seed —
how a statement backfill is rehearsed on a branch of production
(`.claude/skills/collect-statements/SKILL.md`). The seed refuses any
non-local `DIRECT_URL`, since it wipes every table.

Vitest runs on `node`; a component or hook test opts into a DOM with a
`// @vitest-environment jsdom` docblock and renders through
`src/test/renderWithClient.tsx`. Keep DOM-free logic in plain `.ts` modules.
`*.test-d.ts` type assertions run inside `npm test`.

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
  request. Every error it maps to a 5xx is also reported to Sentry and alerted
  to the Telegram ops chat (README "Alerting (Telegram)"). Special routes: `/api/chat` (SSE streaming), `/api/webhook`
  (Telegram, secret-token header), `/api/excel-extraction-agent/webhook`
  (HMAC in query params over `userId:timestamp:importId`, so a callback is
  bound to the import it was submitted for),
  `/api/imports/[importId]/reconciliation-preview` (GET; what approving the
  import would do, writing nothing, each row with a `reviewHint` naming a
  close call), `/api/imports/[importId]` (GET; one
  import with its pending count and, when merged, the import it merged into),
  `/api/auth/*` (cookie handling), `/api/health` (liveness only — touches no
  dependency, so Neon can scale to zero) and `/api/health/deep` (polled at
  most hourly).
- `src/server/` — backend logic: `services/` (business logic; singletons),
  `repositories/` (Prisma),
  `services/assistant/` (Mastra agent, tools, PG-backed memory),
  `auth/` (jose JWT + Upstash Redis sessions + httpOnly cookie),
  `integrations` live inside services as `lazy()` fields.
- `src/shared/` — code both routes and client import: zod request schemas
  (`schemas/`, with inferred types), domain types (`types/`), and cross-cutting
  constants and pure helpers (`dates.ts`, `csv.ts`, `periodBuckets.ts`).
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
  client (OpenAI, Gemini, TypeSafe, Vercel AI Gateway, Telegram, SMTP, S3,
  Google, excel extraction) is built through `lazy()` from
  `src/server/lib/lazy.ts` and reads env inside the factory — `requireEnv`, or
  `optionalEnv` where unset means the feature is off. A missing env var fails
  the call, never the import.
- **Every model call made per transaction row is bounded.** The OpenAI and
  Gemini clients behind `AIProvider`, and any `CategorySuggester`, take their
  timeout (and retry count where the SDK has one) from `AI_REQUEST_LIMITS`
  (`src/server/services/ai/requestLimits.ts`), never an SDK default, because
  those calls run one row at a time inside a batch request. A timeout is an ordinary provider failure that fails its row; the limit is per
  call, so a batch against a degraded provider can still outrun the function.
  The assistant's Mastra model is a separate streaming client and is not bound
  by these limits.
- **Only the category decision may leave the `AI_PROVIDER` model.**
  `AIServiceFactory.getCategorySuggester()` is the one place that decides,
  on `AI_CATEGORY_SUGGESTER`; the prose-producing methods have no such flag.
  Every suggester offers exactly the option list
  `src/server/services/ai/prompts.ts` builds and ends in its
  `buildCategoryEvaluation`, so the flag changes the model and never the
  question or the record.
- **Import matching**: an imported row is paired with an existing transaction
  by `transactionRepository.findPotentialMatches` — ±5 days, and a _relative_
  value tolerance of `max(2, 1%)` (`matchValueTolerance`) — a card dates a row
  by settlement, not purchase, and a flat tolerance does not scale. Among the candidates a single normalized-equal
  description wins outright (`findExactNormalizedMatch`,
  `src/server/utils/transactionMatching.ts`) and never reaches the model; a tie
  or no exact hit does. That short-circuit keeps a multi-month backfill
  affordable.
- **One function decides merge-vs-create.**
  `importService.toReconciliationPlanItem` derives every server path's
  MERGE/CREATE (preview, `batchApproveImportedTransactions`,
  `applyAutoApproveRules`); `ImportedTransactionList` keeps its own client view.
  Commits take row ids, not a plan, so `scripts/import-statements.ts` approves
  the rows it previewed. Applying goes through `applyCreate`/`applyMerge` on the
  row `loadPendingSelection` loaded — never a loop over the public
  `approveImportedTransaction`/`mergeImportedTransaction` — and they return what
  to notify so the batch calls `notifyTransactionsCreatedSafe` once. A merge acts
  on the match as loaded, so a concurrent rematch is not seen. Approve, merge
  and ignore act only on a PENDING, non-deleted row (409 otherwise, 404 once
  deleted), and the write itself is scoped to PENDING, so of two concurrent
  submits one wins and the other gets 409 — in a batch, only that row fails.
- **A preview flags close calls without deciding them.** Each preview item
  carries a `reviewHint` derived after `toReconciliationPlanItem` has fixed the
  action, from database lookups only and never a model call:
  `unmatched-candidate` when a CREATE row still has an unclaimed transaction
  inside its match window (fetched for every CREATE row in one query), and
  `unrelated-merge` when a MERGE's two descriptions share no normalized word.
  The window is `matchWindow` (`src/server/utils/transactionMatching.ts`), the
  same bounds `findPotentialMatches` queries by. Neither hint changes what the
  commit does;
  `scripts/import-statements.ts` prints flagged rows as `CREATE?`/`MERGE?`
  with the other side's description.
- **Duplicate import rows are matched up to a shortened merchant name.**
  `isSameCharge` (`src/server/utils/transactionMatching.ts`) requires equal date,
  value and type, and the shorter normalized description to be whole words from
  either end of the longer one (the extractor drops a trailing branch, mall or
  city, and sometimes a leading "refund"), or a leading prefix past half the
  longer one when the cut lands mid-word. A side under three characters never
  matches. `selectNonDuplicateRows` claims each existing row at most once, so a
  genuinely repeated charge still imports.
- **A duplicate import is kept as a pointer, and its survivor is held until
  the moved rows are matched.** When the extraction webhook finds an older
  COMPLETED import for the same card and month, one transaction moves the
  non-duplicate rows there, puts the survivor in `REMATCHING`, and marks the
  duplicate `MERGED` with `mergedIntoImportId`; the survivor returns to
  `COMPLETED` only after `findPotentialMatchesForImport` has run over it. So
  `COMPLETED` always means "every row's match is decided", the web UI and
  `scripts/import-statements.ts` both wait on that status rather than racing
  it, and the script follows the recorded pointer (`GET /api/imports/[id]`)
  instead of reconstructing the survivor from the filename. A `MERGED` import
  holds no rows and never becomes a merge target (`findExisting` requires
  `COMPLETED`). The submitted payment month wins over the one extraction
  reports, since card + month is the duplicate key. A FAILED import keeps its
  extraction claim, since a redelivery after a partial write would insert every
  row again, so recovery is delete and re-import.
- **Auth**: JWT (jose HS256, 7d) in an httpOnly `session` cookie; Redis key
  `session:<userId>:<token>` must exist (logout deletes it). API routes also
  accept `Authorization: Bearer` (scripts/e2e). Cron routes require
  `Authorization: Bearer ${CRON_SECRET}`; Vercel sends it automatically.
- **Redis keys**: every key written through `src/server/redis.ts` is namespaced
  by `redisKeyPrefix(scope)`, because previews share production's one Upstash
  database. Only production is bare; everything else, an unconfigured local
  process included, is namespaced. Preview caches key on the commit
  (`preview:<sha>:`) so a fix is never served a buggy commit's value; sessions
  and login codes pass `'branch'` (`preview:<branch>:`) to survive pushes.
  Superseded namespaces expire by TTL, except a counter killed between
  INCR and EXPIRE, which has none.
- **Prisma**: schema + migrations in `prisma/`; the app client is
  `@prisma/client` with field-encryption and nothing else, so `DATABASE_URL` can
  be any address that client accepts. On Vercel it is Neon's pooled endpoint
  with `?pgbouncer=true` (plus `connection_limit=1` on serverless), because that
  pooler reuses sessions and collides on prepared statements; `assertCoreEnv`
  refuses a `-pooler` host missing that parameter. `DIRECT_URL` is
  the direct endpoint, used by migrations, the seed, and Mastra's memory store;
  both are scoped per environment, since `vercel-build` runs
  `prisma migrate deploy` against `DIRECT_URL`. CI and `dev:local` keep the app
  on `prisma dev`'s `prisma+postgres://` address: its plain Postgres port
  multiplexes every client onto one backend session, so an app client sharing it
  with the schema engine and Mastra's node-postgres collides on prepared
  statements either way — named (`s0 already exists`) without `pgbouncer=true`,
  unnamed (Mastra's memory store fails to init) with it.
- **Styling**: MUI `sx` + theme tokens only — no inline `style=`, no CSS
  custom properties, no global utility classes, no hardcoded hex in
  components (colours read `(theme.vars ?? theme).palette`, so dark mode resolves; charts use `.charts`).
- **Logging**: pino (`src/server/logging/logger.ts`), metadata object first:
  `logger.info({ userId }, 'msg')`; errors under the `err` key. Outside
  development records also ship to Better Stack through `pino.multistream`
  (never a pino transport — its worker threads are unreliable on Vercel),
  flushed from a `next/server` `after` hook, eagerly on `error`, and once more
  before a cron's heartbeat ping. Warn and above ship, plus any record marked
  `ship: true` — how a healthy cron's request line gets out. Unset
  `BETTERSTACK_SOURCE_URL`/`_TOKEN` turns shipping off. README "Log shipping".
- **Error tracking**: Sentry, inert unless `NEXT_PUBLIC_SENTRY_DSN` is set;
  errors only, no tracing or replay. `sentry.config.ts` holds the single
  `Sentry.init`, run by `src/instrumentation.ts` (Node, edge) and
  `src/instrumentation-client.ts` (browser); `initSentry` takes no arguments
  and reads `process.env` itself, since a constant-folded argument breaks the
  browser bundle. `createHandler` reports every 5xx it turns an error into;
  `onRequestError` covers what escapes a route; React boundaries report via
  `src/components/ErrorFallback.tsx`, skipping errors with a `digest`. A path
  that catches an error and returns a fallback calls `reportSwallowedError`
  (`src/server/logging/reportSwallowedError.ts`), not `logger.error`, so the
  error outlives Better Stack's retention.
- **Who reports a mutation's outcome is per component, not per prop name.**
  `TransactionForm` and `ScheduledTransactionForm` own it: they read a resolved
  `onSubmitAction`/`onDeleteAction` as success, show the snackbar and call
  `onCloseAction`, so a handler passed to them must let the rejection propagate
  or the form reports success on a failed save and closes over the unsaved edit.
  `PendingTransactionsList` is the opposite — it has no error surface, so its
  handlers must not reject and the page catches (`runWithNotice`). A new dialog
  picks one and says which in its props.
- **Comments** only where code cannot explain itself — a surprising why, 1–2
  sentences. Names carry the what; this file carries the design.

## Database (Prisma)

Models: User, Transaction, Category (hierarchical), ScheduledTransaction,
Import/ImportedTransaction, TransactionFile, UserCategoryMapping,
AutoApproveRule, DetectedSubscription, UserNotificationPreference/Provider,
AnnouncementAck.
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
that Better Stack URL after a <400 response (unset var = off); the option
exists only on the `auth: 'cron'` arm of `HandlerOptions`. README "Cron
heartbeats".

## Deployment

Vercel. `vercel-build` runs `prisma generate && prisma migrate deploy && next build`.
Set all env vars from `.env.example`; `CRON_SECRET` must be set or scheduled
jobs 401. Anything that has to name the site's own origin — extraction webhook
callbacks, verification links — goes through `requireSiteUrl()`
(`src/server/env.ts`), never a bare `WEBSITE_URL` read. Set that var on
production and nowhere else: previews leave it unset and derive the origin from
`VERCEL_BRANCH_URL`; production has that fallback gated off so a missing value
fails loudly, and it is resolved before a signup's first write. The Telegram
webhook must be registered with
`setWebhook(url=${WEBSITE_URL}/api/webhook, secret_token=${TELEGRAM_WEBHOOK_SECRET})`.

Functions run in `fra1` (`regions` in `vercel.json`), co-located with Neon and
Upstash so each query and session read stays a same-region round trip. Moving
either store's region moves this one with it.

## Documentation

This file is the only design document. Per-feature plans, specs, and handover
notes are not committed — `.superpowers/`, `docs/superpowers/`, and
`.claude/worktrees/` are gitignored, while `.claude/skills/` and
`.claude/rules/` stay tracked because they are tooling, not scratch. A spec for
shipped work drifts and reads as current intent, so it is not kept.

`.claude/skills/collect-statements/` holds the per-portal recipes for pulling
statements out of Cal, Isracard and Amex IL with Claude in Chrome. Credentials
and one-time passwords are always the human's; the skill records only
navigation, and marks what has not been observed rather than guessing it.

`settings.json` references the `yaniv120892/claude-config` marketplace and
enables `pr-workflows` and `dev-workflows`, so those skills, commands and hooks
are fetched rather than copied and stay current; `CLAUDE_CODE_PLUGIN_PREFER_HTTPS`
keeps that fetch on HTTPS, since a fresh container has no SSH key. `pr-review` and
`prune-comments` stay vendored under `.claude/skills/` as MCP-driven variants,
because this repo's sessions have no `gh` CLI; `steward` stays vendored because
remote sessions read it from the head branch. Each names its upstream in a
`Canonical source` line; edit there first, then re-vendor. Where a vendored
skill shares a name with a plugin skill, follow the vendored copy.
`proof-of-work` and the examples under `pr-description/references/` are this
repo's own — how to prove a change here, and what a good description of one
looks like — and the plugin's `writing-pr-description` reads both.

`.claude/rules/` holds the craft rules (comments, control flow, naming, errors,
typing, env wiring, secrets), vendored from `yaniv120892/claude-config`; each
loads by its `paths:` list. This file is what is true of _this_ system; the
rules are how code gets written anywhere. Edit a rule upstream first, then
re-vendor. The mechanically
checkable ones (`curly`, `array-type`, `explicit-member-accessibility`) are
enforced in `eslint.config.mjs`, so CI fails on them rather than review.

So a PR that changes anything this file states — architecture, an invariant, a
command, a route, a cron, a model — updates the matching section in the same
PR. Record the rule the code now follows, not the story of the change; git log
already holds that. If a change fits no existing section and is not a rule
future work must follow, it does not belong here.
