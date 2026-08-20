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
- Logs: pino JSON to stdout, plus in-app shipping to Better Stack (see
  below), and 5xx responses also page a Telegram ops chat (see Alerting).
  Cron routes throw on partial failure so a failed run shows up as a non-2xx
  in Vercel's cron history

## Log shipping (Better Stack)

Vercel's Hobby plan keeps runtime logs for one hour and Log Drains are a Pro
feature, so logs are shipped from inside the app rather than by the platform.

1. In Better Stack, go to **Telemetry → Sources** and create a source of type
   **HTTP** (any name; "my-expenses" does).
2. The source page shows the **ingesting host** and the **source token** —
   set `BETTERSTACK_SOURCE_URL` to `https://<ingesting-host>` and
   `BETTERSTACK_SOURCE_TOKEN` to that token in the Vercel project env.

Leave both unset and shipping is silently off; stdout logging is unaffected,
so local development and CI need no configuration.

Only **`warn` and above** is shipped. The free tier allows 3 GB a month with
3-day retention, and one `info` line per request would exhaust it while
burying the records worth keeping — the full stream is still in Vercel's logs
for the hour after a request. Records are buffered in memory (capped at 100,
oldest dropped, with the dropped count reported in the next batch) and sent as
one POST per request from a `next/server` `after` hook, which runs once the
response is out and before the serverless instance freezes.

## Alerting (Telegram)

Logs say what happened, but nobody reads them at 03:00. Every response
`createHandler` maps to a 5xx also fires a Telegram message to a dedicated ops
chat, carrying the method, path, request id, user id when there is one, and
the error message. Set `TELEGRAM_ALERT_CHAT_ID` (alongside
`TELEGRAM_BOT_TOKEN`) to turn it on; leave it unset and alerting is silently
off, which is how local development and CI run.

The chat is deliberately separate from user notifications, and the send goes
straight to `telegramService` rather than through the per-user notifier — an
ops alert must not depend on the database, since that is exactly what will be
down.

Alerts are capped at **5 per hour per alert type** (the type is the method and
path, so one hot endpoint cannot mask another), counted in Redis with a single
`INCR`. The alert that trips the cap is replaced by a one-off "further alerts
suppressed" notice, so the silence is never ambiguous. Sending is
fire-and-forget in an `after` hook and never throws: a failed alert is logged
and the response is unaffected.

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
