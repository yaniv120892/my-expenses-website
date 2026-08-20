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

## Uptime monitoring (Better Stack)

Two monitors, on the same endpoint, at deliberately different intervals:

| Monitor | URL                | Interval   | What it touches                                  |
| ------- | ------------------ | ---------- | ------------------------------------------------ |
| Shallow | `/api/health`      | 3 minutes  | Nothing — proves Vercel is still serving the app |
| Deep    | `/api/health/deep` | 60 minutes | Postgres (`SELECT 1`) and Redis (`GET`)          |

The deep response reports each dependency separately — `{"status":"unhealthy",
"checks":{"db":"fail","redis":"ok"}}` with HTTP 503 — so the alert email names
what broke. Both responses are `Cache-Control: no-store`.

### Do not lower the deep interval

Neon Free gives 100 CU-hours/month at 0.25 CU, and scale-to-zero after 5 idle
minutes cannot be disabled. Every deep check wakes the compute and restarts that
idle timer, so the interval sets the bill: at 3 minutes the compute never sleeps
(730 h x 0.25 CU = **~182 CU-hours, 1.8x the allowance** — the monitor causes
the outage it was installed to catch); at 60 minutes it is 24 wakes x 5 min/day
= **~15 CU-hours.**

That is why the frequent monitor hits the shallow path, which must stay free of
any database or Redis call.

The two checks are separate routes rather than one route behind a `?deep=` flag,
so a mistyped deep-monitor URL is a 404 that goes red within one interval
instead of silently degrading into a second shallow monitor reporting green.
Each probe gives up after 5s, so a blackholed dependency still returns the 503
naming it rather than a bodiless platform timeout.

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
