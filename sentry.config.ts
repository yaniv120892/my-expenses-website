import * as Sentry from '@sentry/nextjs';

// Every value is read inline: Next's minifier inlines a constant-folded
// parameter into an unbound `{environment}` shorthand that throws in the
// browser bundle.
export function initSentry(): void {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return;
  }

  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment:
      process.env.NEXT_PUBLIC_VERCEL_ENV ??
      process.env.VERCEL_ENV ??
      process.env.NODE_ENV,
    // Traces and Session Replay bill against their own quotas; only errors are
    // budgeted.
    tracesSampleRate: 0,
  });
}
