# API end-to-end harness

Exercises the riskiest part of the app — the Mastra chat assistant streaming
over SSE from a Next.js route handler — against a real local Postgres, a mock
OpenAI-compatible model server, and an in-process Upstash REST shim. No real
API keys or external services are needed.

## What it checks

- Chat streams SSE incrementally (not one burst) and figures come from tool
  results computed in TypeScript, not the model
- All five assistant tools are offered; comparePeriods is called for
  comparisons
- Cross-user isolation: user B's amounts never appear in user A's stream
- Mastra creates its own `mastra` Postgres schema without Prisma drift
- Memory persists conversation threads
- Unauthenticated requests get 401; a mid-stream disconnect aborts the agent
  run and does not crash the server

## Running

`npm run dev:local` assembles this whole environment — database, migrations,
the three mock servers, the seed, and the app — and stays up. Read
`scripts/dev-local.sh` for the env every piece needs; it is a copy of the
`env:` block in `.github/workflows/ci.yml`.

`npm run test:e2e:api` (`run.ts`) brings the same stack up on its own and exits
when the checks finish, so it binds the ports `dev:local` already holds. Stop
`dev:local` first.

`serve.ts` is the third entry point: the same stack, staying alive, printing
`E2E_AUTH_TOKEN` for the Playwright chat spec (`e2e/chat.spec.ts`) and the
seeded credentials for `dev:local`.

## Serverless traps this guards against

The Express-era version of this harness caught module-load-time construction
of network clients (OpenAI, Telegram, SMTP, S3) taking the whole server down
when an env var was missing. In this repo every external client is built
lazily via `src/server/lib/lazy.ts` — keep it that way; the warm-up check
here fails if importing a route module starts throwing again.
