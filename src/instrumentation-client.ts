import * as Sentry from '@sentry/nextjs';

// Session Replay is deliberately not added: `replayIntegration` is opt-in and
// bills against its own quota.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  // The free tier budgets 5k errors a month; traces bill against a separate
  // quota, so nothing is sampled for performance.
  tracesSampleRate: 0,
});
