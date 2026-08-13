export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { assertCoreEnv } = await import('@/server/env');
    // Fail a misconfigured deployment at boot, not on the first request.
    if (process.env.NODE_ENV === 'production') {
      assertCoreEnv();
    }
  }
}

// Errors raised outside a createHandler route (server components, uncaught
// route failures) reach Next here and would otherwise be logged unstructured.
export async function onRequestError(
  err: unknown,
  request: { path: string; method: string },
) {
  const { default: logger } = await import('@/server/logging/logger');
  logger.error(
    { err, path: request.path, method: request.method },
    'Unhandled request error',
  );
}
