# Cost fences

Load before adding or changing a path that spends money per request — a model call, a mail, an
upload or a statement import — or a limit in `src/server/costFences.ts`.

Every budget and rate limit is a named constant in `src/server/costFences.ts`. The per-call model
limits stay in `AI_REQUEST_LIMITS` → [ai-categorization.md](ai-categorization.md), before changing
a model call. The description cap is `DESCRIPTION_MAX_LENGTH` in `src/shared/descriptions.ts`.
The guards come from
`@yaniv120892/app-kit` and are built once in `src/server/guards.ts`, over the same Redis as the
rest of the app, with every key namespaced by `redisKeyPrefix` → [redis.md](redis.md), before
writing a Redis key.

## Paid paths fail closed

A paid fence refuses while its counter store is down, and the app-kit guard throttles its outage
report per instance. The older `createHandler` rate limits
(`src/server/http/rateLimit.ts`) fail open and still guard sign-in, chat bursts and the rest →
[api-routes.md](api-routes.md), before changing a route's rate limit. A paid route answers a
refusal as a response from `src/server/http/guardRefusal.ts` rather than throwing it, so a
store outage is not reported as a 5xx on every request.

## Daily budgets

A daily budget counts one subject and everyone together per UTC day. Its global limit is the
cap on a bad day's cost, tunable per environment as `<FEATURE>_GLOBAL_DAILY_LIMIT`, and
`<FEATURE>_ENABLED=false` turns the feature off without a deploy.

- `categorization`, per household — counted only when the description has no household mapping
  and the model is about to be asked. A refusal leaves the category unchosen, so the create
  falls back to asking the user for one: nothing the user entered is lost →
  [ai-categorization.md](ai-categorization.md), before changing a model call.
- `chat`, per member — reserved before the assistant streams.

## Rate limits

Statement uploads, and statement processing with re-matching, are counted per household by the
hour and by the UTC day; the test monthly report per member by the hour.

## The daily backup

The backup cron copies only the households listed in `BACKUP_HOUSEHOLD_IDS` into the owner's
storage. Unset backs up no household and logs a warning, so a stranger's data never lands
there.
