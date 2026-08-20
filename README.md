# My Expenses

Personal expense management: transaction tracking with AI-powered
categorization, bulk imports from credit-card statements, scheduled and
recurring transactions, subscription detection, trends, Telegram bot, and a
streaming AI chat assistant — all in a single Next.js application that serves
both the web UI and the API.

## Stack

- **App**: Next.js 15 (App Router) + React 19 + MUI 7 + TanStack Query 5
- **API**: Next.js route handlers under `src/app/api`, business logic in
  `src/server`
- **Database**: PostgreSQL via Prisma (Accelerate for the app,
  field-level encryption for sensitive columns)
- **Auth**: JWT (jose) in an httpOnly cookie + Upstash Redis sessions
- **AI**: Mastra agent (chat assistant with tools + PG memory), OpenAI or
  Gemini via `AI_PROVIDER`, plus an external FastText categorizer service
- **Observability**: pino structured logs, Vercel Analytics + Speed Insights

## Getting started

```bash
npm install
cp .env.example .env   # fill in values
npm run db:migrate     # applies prisma/migrations via DIRECT_URL
npm run dev            # http://localhost:3000
```

`DATABASE_URL` must be a Prisma Accelerate URL (`prisma://…`); `DIRECT_URL`
is the plain Postgres connection used by migrations, the e2e seed, and the
assistant's memory store. For local development `npx prisma dev` provides a
compatible local setup.

## Scripts

| Script                                  | What it does                                    |
| --------------------------------------- | ----------------------------------------------- |
| `npm run dev`                           | Dev server (Turbopack)                          |
| `npm run build`                         | `prisma generate && next build`                 |
| `npm run typecheck` / `lint` / `format` | Quality gates (also run pre-commit)             |
| `npm run db:migrate`                    | `prisma migrate deploy`                         |
| `npm run test:e2e:api`                  | API/chat harness — see `test/e2e-api/README.md` |
| `npm run test:e2e:ui`                   | Playwright specs in `e2e/`                      |

## Deployment (Vercel)

- `vercel-build` runs migrations before `next build`
- Cron jobs are declared in `vercel.json`; set `CRON_SECRET` in the project
  env or the cron routes will reject Vercel's invocations
- Register the Telegram webhook once per environment:
  `https://api.telegram.org/bot<token>/setWebhook?url=<WEBSITE_URL>/api/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>`
- Logs: pino JSON to stdout — attach a Vercel Log Drain (e.g. Better Stack)
  to ship them; no in-app log shipping. Errors are logged, not sent to an
  error tracker; cron routes throw on partial failure so a failed run shows
  up as a non-2xx in Vercel's cron history

## Cron heartbeats

Runtime logs are retained for one hour on Vercel Hobby, so a cron that fails
or never fires leaves no trace. Each cron route pings a Better Stack heartbeat
after a successful run (a `< 400` response); Better Stack emails when a ping
stops arriving. A partial failure already throws — see the routes — so a
missed ping covers both "ran and failed" and "never ran".

Create one heartbeat per row in Better Stack (the free tier includes 10), then
set the URL it gives you as the matching env var. **Any var left unset simply
disables that heartbeat** — nothing else changes.

| Cron                                  | Schedule         | Env var                                                | Period / grace |
| ------------------------------------- | ---------------- | ------------------------------------------------------ | -------------- |
| `/api/scheduled-transactions/process` | 07:00 daily      | `BETTERSTACK_HEARTBEAT_SCHEDULED_TRANSACTIONS_PROCESS` | 24h / 1h       |
| `/api/summary/today`                  | 21:00 daily      | `BETTERSTACK_HEARTBEAT_SUMMARY_TODAY`                  | 24h / 1h       |
| `/api/backup/transactions`            | 03:00 daily      | `BETTERSTACK_HEARTBEAT_BACKUP_TRANSACTIONS`            | 24h / 1h       |
| `/api/subscriptions/detect`           | 04:00 Mondays    | `BETTERSTACK_HEARTBEAT_SUBSCRIPTIONS_DETECT`           | 7d / 2h        |
| `/api/subscriptions/audit-notify`     | 08:00 Mondays    | `BETTERSTACK_HEARTBEAT_SUBSCRIPTIONS_AUDIT_NOTIFY`     | 7d / 2h        |
| `/api/reports/monthly`                | 06:00 on the 1st | `BETTERSTACK_HEARTBEAT_REPORTS_MONTHLY`                | 31d / 2h       |

The monthly period is 31 days because that is the longest gap between two
first-of-the-month runs; a shorter period would alert every February.

## External services

| Service                  | Contract                                                                                                                |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| expense-categorizer      | `POST ${EXPENSE_CATEGORIZER_BASE_URL}/predict` `{description}` → category + confidence                                  |
| excel-extraction-service | `POST ${EXCEL_EXTRACTION_AGENT_URL}/api/extract`; result arrives at `/api/excel-extraction-agent/webhook` (HMAC-signed) |

## History

The backend previously lived in the now-deprecated
[my-expenses](https://github.com/yaniv120892/my-expenses) repository and was
consolidated here — route handlers replaced Express, class-validator DTOs
became zod schemas, and all external clients construct lazily (serverless-safe).
