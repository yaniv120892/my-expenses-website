# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Single Next.js 16 (App Router) application serving both the frontend and the backend of an expense management system with AI-powered categorization and a chat assistant.

One sibling service stays external and is reached over HTTP: `excel-extraction-service` (Express + Gemini, async webhook callbacks). Transaction categories come from a user's own description mapping first, then the AI provider.

## Commands

Scripts are in `package.json`. `npm run dev:local` is the supported way to run the app →
[docs/local-development.md](docs/local-development.md), also for the statement and benchmark
scripts' arguments.

ESLint, Prettier, tsconfig and lint-staged come from the shared
`@yaniv120892/dev-config` package (pinned by tag in `package.json`);
`eslint.config.mjs` and `tsconfig.json` only extend its `next` presets with this
repo's ignores and paths. Pre-commit runs lint-staged + typecheck (husky). CI
(`.github/workflows/ci.yml`) runs the `checks` job through dev-config's reusable
`node-ci.yml` at the same tag — audit, prettier, lint with `--max-warnings=0`,
typecheck, unit tests and the build — and in a parallel `e2e` job both e2e
suites against a Postgres service container. Bump the tag in both places
together.

## Docs

Short docs, one topic each. Load the one whose trigger matches your task.

- [DECISIONS.md](DECISIONS.md) — the hard-to-reverse decisions and why. Load before reversing or
  adding one.
- [docs/api-routes.md](docs/api-routes.md) — `createHandler`, rate limits, `recordIdSchema`, the
  special routes, proxy and headers. Load before adding or changing an API route.
- [docs/auth-and-api-tokens.md](docs/auth-and-api-tokens.md) — sessions, `tokenVersion`, API-token
  scopes. Load before changing sign-in, a route's `auth` or `apiTokenScope`.
- [docs/households.md](docs/households.md) — household scoping, roles and the write guard. Load
  before any repository or service query, a write route, a new model, or a cron.
- [docs/household-membership.md](docs/household-membership.md) — invites, joining, leaving,
  removal. Load before changing household membership or `/join`.
- [docs/household-activity.md](docs/household-activity.md) — write attribution and the activity
  log. Load before adding a write to household data or a system job that writes.
- [docs/money-and-currency.md](docs/money-and-currency.md) — ILS `value`, original currency,
  exchange rates, amount bounds. Load before touching an amount, a rate or a total.
- [docs/import-matching.md](docs/import-matching.md) — matching, merge-vs-create, preview hints,
  duplicate rows. Load before changing how an imported row is matched or approved.
- [docs/import-lifecycle.md](docs/import-lifecycle.md) — import statuses, duplicate imports, the
  extraction webhook, stuck and failed imports. Load before changing an import's status flow.
- [docs/ai-categorization.md](docs/ai-categorization.md) — AI providers, category suggesters,
  request limits, the assistant. Load before changing a model call or a prompt.
- [docs/personal-agent-mcp.md](docs/personal-agent-mcp.md) — `/api/mcp` and its tools, agent
  dates. Load before changing an MCP tool or the agent briefing.
- [docs/uploads-and-storage.md](docs/uploads-and-storage.md) — the upload cap, S3 keys and
  attachment deletion. Load before changing an upload or a delete path.
- [docs/telegram.md](docs/telegram.md) — chat linking and the bot webhook. Load before changing
  Telegram notifications or Settings → Telegram.
- [docs/redis.md](docs/redis.md) — key namespacing across previews. Load before writing a Redis
  key or cache.
- [docs/database.md](docs/database.md) — Prisma client, connections, SSL, encryption at rest. Load
  before a schema change, a migration, or database connection code.
- [docs/observability.md](docs/observability.md) — log shipping, Sentry, product events,
  heartbeats. Load before adding error reporting, a product event or a cron heartbeat.
- [docs/deployment.md](docs/deployment.md) — Vercel, env vars, the site origin, region, crons.
  Load before changing `vercel.json`, a cron or per-environment config.
- [docs/ui.md](docs/ui.md) — shell, i18n, formatting, RTL, polling. Load before adding a page,
  user-visible text or a formatted value.
- [docs/testing.md](docs/testing.md) — Vitest environments, render helpers, the e2e suites. Load
  before writing or fixing a test.
- [docs/local-development.md](docs/local-development.md) — `dev:local`, running over another
  database, script arguments. Load before running the app or a statement backfill.
- [docs/dependency-updates.md](docs/dependency-updates.md) — Dependabot and the auto-merge
  policy. Load before changing either, or judging a Dependabot PR.
- [docs/claude-tooling.md](docs/claude-tooling.md) — plugins, vendored skills and rules. Load
  before editing anything under `.claude/`.

`.claude/rules/` holds path-scoped rules that load when you open a matching file;
`ui-components.md` is this repo's styling and mutation-outcome rule for `.tsx` files.

## Architecture

- `src/app/` — App Router. `(auth)/` login/signup/verify; `join/` redeems a household invite;
  `(app)/` the authenticated pages inside `ExpensesShell`.
- `src/app/api/**/route.ts` — all API endpoints, most built with `createHandler`
  (`src/server/http/handler.ts`).
- `src/server/` — backend logic: `services/` (business logic; singletons), `repositories/`
  (Prisma), `services/assistant/` (Mastra agent, tools, PG-backed memory, and
  `financeQueries.ts`, the read-side figures both assistants share), `mcp/` (the MCP server
  behind `/api/mcp`), `auth/` (jose JWT + Upstash Redis sessions + httpOnly cookie),
  `integrations` live inside services as `lazy()` fields.
- `src/shared/` — code both routes and client import: zod request schemas (`schemas/`, with
  inferred types), domain types (`types/`), and cross-cutting constants and pure helpers
  (`dates.ts`, `csv.ts`, `periodBuckets.ts`).
- `src/components/`, `src/hooks/` (TanStack Query v5, query-key factories), `src/services/` (thin
  axios client, SSE chat client), `src/utils/` (pure helpers — components and hooks import from
  here, never the reverse), `src/test/` (test-only render helpers).

## Key invariants

- **No module-load-time construction of network clients.** Every external
  client (OpenAI, Gemini, TypeSafe, Vercel AI Gateway, Telegram, SMTP, S3,
  Google, excel extraction) is built through `lazy()` from
  `src/server/lib/lazy.ts` and reads env inside the factory — `requireEnv`, or
  `optionalEnv` where unset means the feature is off. A missing env var fails
  the call, never the import.
- **Every household-owned row is read and written by `householdId`.**
  Repositories take the `HouseholdId` first; the default `prisma` client throws
  `UnscopedHouseholdQueryError` on a query that does not name one →
  [docs/households.md](docs/households.md), before any query or write route.
- **Money: `value` is always ILS; the original currency rides beside it.** No
  total adds two currencies, and no rate falls back to 1:1 →
  [docs/money-and-currency.md](docs/money-and-currency.md), before touching an
  amount.
- **A uuid-checked id goes through `recordIdSchema`**
  (`src/shared/schemas/common.ts`) — route params, request schemas and MCP tool
  schemas alike.
- **Logging**: `logger` from `@/server/observability`, metadata object first:
  `logger.info({ userId }, 'msg')`; errors under the `err` key. A path that
  catches an error and returns a fallback calls `observability.reportError`
  instead, with only ids and fixed labels in `context` →
  [docs/observability.md](docs/observability.md).
- **Comments** only where code cannot explain itself — a surprising why, 1–2
  sentences. Names carry the what; the docs carry the design.

## Documentation

Docs are [DECISIONS.md](DECISIONS.md) plus one short `docs/<topic>.md` per area,
each listed above with the task that should load it. A rule that must load
whenever certain files are touched goes in `.claude/rules/` with a `paths:` list.
Per-feature plans, specs, and handover notes are not committed — `.superpowers/`,
`docs/superpowers/`, and `.claude/worktrees/` are gitignored, while
`.claude/skills/` and `.claude/rules/` stay tracked because they are tooling, not
scratch. A spec for shipped work drifts and reads as current intent, so it is not
kept.

So a PR that changes anything a doc states — architecture, an invariant, a
command, a route, a cron, a model — updates the matching doc in the same PR, and a
new hard-to-reverse decision adds a `DECISIONS.md` row. A new topic gets its own
doc and an index line above. Record the rule the code now follows, not the story
of the change; git log already holds that. If a change fits no existing doc and
is not a rule future work must follow, it does not belong in the docs.
