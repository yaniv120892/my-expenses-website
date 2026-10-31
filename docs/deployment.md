# Deployment

Load before changing `vercel.json`, a cron, an env var's per-environment setup, the function
region, or anything that names the site's own origin.

Vercel. `vercel-build` runs `prisma generate && prisma migrate deploy && next build`. Set all env
vars from `.env.example`; `CRON_SECRET` must be set or scheduled jobs 401. Database env vars →
[database.md](database.md), before changing `DATABASE_URL` or `DIRECT_URL`.

## The site's own origin

Anything that has to name the site's own origin — extraction webhook callbacks, verification links
— goes through `requireSiteUrl()` (`src/server/env.ts`), never a bare `WEBSITE_URL` read. Set that
var on production and nowhere else: previews leave it unset and derive the origin from
`VERCEL_BRANCH_URL`; production has that fallback gated off so a missing value fails loudly, and
it is resolved before a signup's first write.

The Telegram webhook must be registered with
`setWebhook(url=${WEBSITE_URL}/api/webhook, secret_token=${TELEGRAM_WEBHOOK_SECRET})`.

## Region

Functions run in `fra1` (`regions` in `vercel.json`), co-located with Neon and Upstash so each
query and session read stays a same-region round trip. Moving either store's region moves this
one with it.

## Crons

The schedule is `crons` in `vercel.json`. Cron routes are `auth: 'cron'` and require
`Authorization: Bearer ${CRON_SECRET}`, which Vercel sends automatically. Each pings a heartbeat
after a successful run → [observability.md](observability.md), before adding a cron. Which crons
run per household and which per member → [households.md](households.md), before adding a cron that
reads user data.
