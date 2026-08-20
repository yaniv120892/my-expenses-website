import type { Instrumentation } from 'next';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { assertCoreEnv } = await import('@/server/env');

    if (process.env.NODE_ENV === 'production') {
      assertCoreEnv();
    }
  }

  const { initSentry } = await import('../sentry.config');
  initSentry(process.env.VERCEL_ENV ?? process.env.NODE_ENV);
}

// Errors raised outside a createHandler route (server components, uncaught
// route failures) reach Next here and would otherwise be logged unstructured.
export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context,
) => {
  const { default: logger } = await import('@/server/logging/logger');
  logger.error(
    { err, path: request.path, method: request.method },
    'Unhandled request error',
  );

  const Sentry = await import('@sentry/nextjs');
  Sentry.captureRequestError(err, request, context);
};
