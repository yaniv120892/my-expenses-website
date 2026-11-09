# Local development

Load before running the app locally, changing `scripts/dev-local.sh` or the seed, or rehearsing a
statement backfill against a copy of production.

## `npm run dev:local`

`npm run dev:local` (`scripts/dev-local.sh`) is the supported way to run the app: database,
migrations, mock services, and the dev server, blocking until `/api/health/deep` is green. Its env
block mirrors the `env:` block of CI's e2e job (`.github/workflows/ci.yml`) — change both
together.

It restarts `prisma dev` each run, because that server's pooler hands `migrate deploy` the
previous run's session and it dies on an already-prepared statement.

`prisma dev`'s plain TCP address multiplexes every client onto one backend session, so Mastra's
statements can interleave with the app's there (`bind message supplies N parameters`); a real
Postgres never does that. CI's e2e job runs on a Postgres service container instead.

## Running over another database

Presetting `DATABASE_URL` and `DIRECT_URL` (plus `REMOTE_DATABASE_OK=1` and `SESSION_USER_EMAIL`)
runs the same stack over that database with no seed — how a statement backfill is rehearsed on a
branch of production (`.claude/skills/collect-statements/SKILL.md`). The seed refuses any
non-local `DIRECT_URL`, since it wipes every table.

## Scripts with arguments

```bash
npm run statements:import -- <dir> [--dry-run] [--resubmit] [--base-url=<url>]   # bulk import + reconcile
npm run statements:due -- [--sources=<json>] [--base-url=<url>]   # closed statements not yet imported, per card login
npm run categories:compare -- [--samples=<json>] [--out=<json>] [--only=jev|llm] [--repeat=<n>]  # Jev vs LLM categorization benchmark
```

The statement scripts' header comments name the token env var each one reads.
