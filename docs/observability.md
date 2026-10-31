# Observability

Load before adding error reporting, a log line that must ship, a Sentry option, a product event,
a cron heartbeat, or touching `src/server/observability.ts`, `src/instrumentation*.ts` or
`src/server/productEvents.ts`. The setup steps for Better Stack, heartbeats and Telegram alerts
are in the README.

Observability comes from the shared `@yaniv120892/observability` package, wired once in
`src/server/observability.ts` (`logger`, `observability`); its README is the reference for
shipping, Sentry, heartbeats and alerts. Only app wiring lives here: the Redis `alertCounter`, the
health probes, and the call sites.

## Log shipping

`level` is a label (`"warn"`) and every record carries `service`. Outside development warn and
above ship to Better Stack, plus any record marked `ship: true` — how a healthy cron's request
line gets out; `createHandler` also flushes before a cron's heartbeat ping. Unset
`BETTERSTACK_SOURCE_URL`/`_TOKEN` turns shipping off. README "Log shipping".

## Error tracking

- Sentry, inert unless `NEXT_PUBLIC_SENTRY_DSN` is set; errors only, no tracing or replay, and no
  identifying request data — its `dataCollection` sends no cookies, bodies, stack-frame locals, IP
  or forwarding headers, or user identity, which the SDK otherwise collects by default.
- Outgoing request breadcrumbs keep only the URL's origin, method, status and body sizes, so an S3
  call's key (an older one ends with the file name) never reaches Sentry, and no URL keeps its
  query string; `src/instrumentation.test.ts` pins this for the server init.
- The package's `initSentry` holds the single `Sentry.init`, run by `src/instrumentation.ts`
  (Node, edge) and `src/instrumentation-client.ts` (browser).
- `createHandler` reports every 5xx it turns an error into; `onRequestError` covers what escapes a
  route; React boundaries report via `src/components/ErrorFallback.tsx`, skipping errors with a
  `digest`.
- A path that catches an error and returns a fallback calls
  `observability.reportError({ error, where, context })`, not `logger.error`, so the error
  outlives Better Stack's retention; Sentry gets the `context` as `extra` and its short values as
  tags beside `where`, so the ids a call site passes are searchable there.
- Only ids and fixed labels go in `context` — never a file name, an attachment key (an older one
  ends with one), an email or free text; what a human needs beyond the ids goes in a separate
  `logger` line.
- `reportError` sets no Sentry user, so `createHandler` and the chat stream keep their own
  `Sentry.captureException`, which attaches the user id.

## Product events

- Product events go to PostHog through `captureProductEvent` (`src/server/productEvents.ts`),
  server-side only, after the action has succeeded; the package sends them once the response is
  out and never throws, and `POSTHOG_PROJECT_KEY` unset turns them off.
- The catalog is the `ProductEvent` union (`productEvents.types.ts`); a new event is a new member.
- The user is the internal user id, and a property is a fixed label, never an email, name, amount,
  merchant or description.
- A transaction write carries `channel`: `web` from the REST routes, `agent` from the MCP tools.
- A page view is recorded by the page's own `layout.tsx`, built by `pageViewLayout`
  (`src/server/pageViews.ts`), so a search-param change is not another view; it checks only the
  JWT signature, as the proxy does.

## Cron heartbeats

Each cron route passes its `heartbeatEnvVar` to `createHandler`, which pings that Better Stack URL
after a <400 response (unset var = off); the option exists only on the `auth: 'cron'` arm of
`HandlerOptions`. README "Cron heartbeats".
