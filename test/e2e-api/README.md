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

1. Start a local Postgres and apply migrations:

   ```bash
   docker run -d --name e2e-pg -p 5433:5432 \
     -e POSTGRES_USER=user -e POSTGRES_PASSWORD=password \
     -e POSTGRES_DB=my-expenses postgres:15
   export DIRECT_URL='postgresql://user:password@127.0.0.1:5433/my-expenses'
   npx prisma migrate deploy
   ```

2. Start the app with the harness environment. The app's Prisma client runs
   through Accelerate (`prisma://` DATABASE_URL); for a local run either use
   `npx prisma dev` or point DATABASE_URL at a local Accelerate-compatible
   proxy. The assistant memory and the seed use DIRECT_URL.

   ```bash
   JWT_SECRET=e2e-test-secret \
   REDIS_URL=http://127.0.0.1:51230 REDIS_TOKEN=e2e \
   AI_PROVIDER=chatgpt OPENAI_API_KEY=e2e \
   ASSISTANT_MODEL_URL=http://127.0.0.1:51231/v1 \
   DIRECT_URL=... DATABASE_URL=... CRON_SECRET=e2e \
   npm run dev
   ```

   Leave `TELEGRAM_BOT_TOKEN` unset locally — with no token the bot code
   no-ops instead of opening sockets to api.telegram.org.

3. In a second terminal, with the same `JWT_SECRET`/`DIRECT_URL`/`REDIS_URL`:

   ```bash
   npm run test:e2e:api
   ```

`test/e2e-api/serve.ts` (`npx tsx test/e2e-api/serve.ts`) brings up the same
stack but stays alive and prints `E2E_AUTH_TOKEN` for the Playwright chat
spec (`e2e/chat.spec.ts`).

## Serverless traps this guards against

The Express-era version of this harness caught module-load-time construction
of network clients (OpenAI, Telegram, SMTP, S3) taking the whole server down
when an env var was missing. In this repo every external client is built
lazily via `src/server/lib/lazy.ts` — keep it that way; the warm-up check
here fails if importing a route module starts throwing again.
