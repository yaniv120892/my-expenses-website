import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { assertCoreEnv } = await import('@/server/env');
    // Fail a misconfigured deployment at boot, not on the first request.
    if (process.env.NODE_ENV === 'production') {
      assertCoreEnv();
    }

    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 0.1,
      enabled: Boolean(process.env.SENTRY_DSN),
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
