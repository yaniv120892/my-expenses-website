import type { Instrumentation } from 'next';

export async function register() {
  // Initialised first so that a missing core env var — which takes the whole
  // deployment down — is itself reportable.
  const { initSentry } = await import('@yaniv120892/observability/next/sentry');
  initSentry();

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { assertCoreEnv } = await import('@/server/env');

    if (process.env.NODE_ENV === 'production') {
      assertCoreEnv();
    }
  }
}

// Errors raised outside a createHandler route (server components, uncaught
// route failures) reach Next here. The dynamic import keeps pino out of the
// Edge bundle.
export const onRequestError: Instrumentation.onRequestError = async (...requestErrorArguments) => {
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }
  const { observability } = await import('@/server/observability');
  await observability.onRequestError(...requestErrorArguments);
};
