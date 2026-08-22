import * as Sentry from '@sentry/nextjs';

// Shared by the Node, edge and browser entry points. Every value is read
// inline: Next 15.3.8's minifier inlines a parameter whose argument
// constant-folds into a `{environment}` shorthand without emitting the
// binding, which throws ReferenceError in the browser bundle.
export function initSentry(): void {
  // No DSN means no Sentry project is configured, so the SDK stays uninstalled
  // rather than merely disabled.
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return;
  }

  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment:
      process.env.NEXT_PUBLIC_VERCEL_ENV ??
      process.env.VERCEL_ENV ??
      process.env.NODE_ENV,
    // The free tier budgets 5k errors a month, and traces bill against a
    // separate quota, so nothing is sampled for performance. Session Replay is
    // omitted for the same reason: `replayIntegration` is opt-in and bills on
    // its own quota.
    tracesSampleRate: 0,
  });
}
