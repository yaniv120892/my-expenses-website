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

**`warn` and above** is shipped, plus any record marked `ship: true`. The free
tier allows 3 GB a month with 3-day retention, and one `info` line per request
would exhaust it while burying the records worth keeping — the full stream is
still in Vercel's logs for the hour after a request. The marker is the
exception that pays for itself: `createHandler` sets it on the request line of
every `auth: 'cron'` route, six lines a day, so a cron that ran and finished
says so. Without it a successful run and a run killed mid-request both ship
nothing, and the absence of logs means nothing at all.

Records are buffered in memory (capped at 100, oldest dropped, with the dropped
count reported in the next batch) and sent as one POST per request from a
`next/server` `after` hook, which runs once the response is out and before the
serverless instance freezes. Two cases do not wait for that hook, because a
process that dies takes the whole buffer with it: an `error` record ships the
moment it is logged (guarded, so a burst costs one extra POST rather than one
per record), and `createHandler` flushes before pinging a heartbeat, the
outbound call most likely to hang.

## Cron heartbeats

Runtime logs are retained for one hour on Vercel Hobby, so a cron that fails
or never fires leaves no trace. Each cron route pings a Better Stack heartbeat
after a successful run (a `< 400` response); Better Stack emails when a ping
stops arriving. A partial failure already throws — see the routes — so a
missed ping covers both "ran and failed" and "never ran".

Every cron route in `vercel.json` names its heartbeat env var inline
(`heartbeatEnvVar: 'BETTERSTACK_HEARTBEAT_…'`), an option `createHandler`
accepts only on `auth: 'cron'` handlers — anywhere else it is a type error. The
full set is listed in `.env.example`. Create one heartbeat per var in Better
Stack (the free tier includes 10) and paste the URL it gives you into the
matching var. **Any var left unset simply disables that heartbeat** — nothing
else changes, so `pingHeartbeat` warns rather than logs `info` when it finds no
URL: an unset var is a no-op that looks identical to a ping that never arrived,
and only the warn ships far enough to tell them apart.

A missed ping says a run did not finish, never why. The paired signal is the
run's own request line, which ships because `createHandler` marks cron routes
(see "Log shipping"): a heartbeat incident with no matching line in Better
Stack means the run did not get to the end of the handler.

Set each heartbeat's period to the longest possible gap between two runs, plus
a grace window: 24h / 1h for the daily crons, 7d / 2h for the weekly ones, and
31d / 2h for the monthly report — 31 days because that is the longest gap
between two first-of-the-month runs, and a shorter period would alert every
February.

## Alerting (Telegram)

Logs say what happened, but nobody reads them at 03:00. Every response
`createHandler` maps to a 5xx also fires a Telegram message to a dedicated ops
chat, carrying the method, path, request id, user id when there is one, and
the error message. Set `TELEGRAM_ALERT_CHAT_ID` (alongside
`TELEGRAM_BOT_TOKEN`) to turn it on; leave it unset and alerting is silently
off, which is how local development and CI run. Get the chat id by messaging
the bot and reading `result[].message.chat.id` from
`https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getUpdates`, then confirm it
with `POST /api/user/settings/test-telegram`.

The chat is deliberately separate from user notifications, and the send goes
straight to `telegramService` rather than through the per-user notifier — an
ops alert must not depend on the database, since that is exactly what will be
down. Alert text is Markdown-escaped before sending: `telegramService` posts
with `parse_mode: 'Markdown'`, and an unescaped underscore, asterisk, bracket
or backtick in an error message makes Telegram reject the send outright.

Alerts are capped at **5 per hour per alert type**, where the type is the
method plus the _route pattern_ — `/api/transactions/[id]`, not the concrete
id — so a storm across many records still trips one shared cap and Redis does
not accumulate a key per record. The cap is counted with a single `INCR`,
which keeps a 5xx storm inside the Upstash free tier's 500K monthly command
budget. The alert that trips the cap is replaced by a one-off "further alerts
suppressed" notice, so the silence is never ambiguous. Sending is
fire-and-forget in an `after` hook and never throws: a failed alert is logged
and the response is unaffected.

## Uptime monitoring (Better Stack)

Two monitors, on two routes, at deliberately different intervals:

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
so a mistyped path under `/api/` is a 404 that goes red within one interval
instead of silently degrading into a second shallow monitor reporting green.
Each probe gives up after 5s, so a blackholed dependency still returns the 503
naming it rather than a bodiless platform timeout.

That 404 only covers typos _after_ the `/api/` prefix. A URL that drops the
prefix — `/health/deep` — misses the `/api/` branch in `src/middleware.ts`,
redirects to `/login`, and a redirect-following monitor records that page's 200. **Configure the deep monitor to require the string `checks` in the
response body**, which no other page returns; that is what makes a
wrong-URL failure visible regardless of how it is wrong.

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
