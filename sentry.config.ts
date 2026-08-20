import * as Sentry from '@sentry/nextjs';

// Shared by the Node, edge and browser entry points; only `environment`
// differs, because the browser can read the deploy environment only from the
// NEXT_PUBLIC_ copy of the variable.
export function initSentry(environment: string | undefined): void {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
    environment,
    // The free tier budgets 5k errors a month, and traces bill against a
    // separate quota, so nothing is sampled for performance. Session Replay is
    // omitted for the same reason: `replayIntegration` is opt-in and bills on
    // its own quota.
    tracesSampleRate: 0,
  });
}
