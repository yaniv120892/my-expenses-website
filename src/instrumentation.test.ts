import { beforeEach, describe, expect, it, vi } from 'vitest';

const { logger, captureRequestError } = vi.hoisted(() => ({
  logger: { error: vi.fn() },
  captureRequestError: vi.fn(),
}));

vi.mock('@/server/logging/logger', () => ({ default: logger }));
vi.mock('@sentry/nextjs', () => ({ captureRequestError }));

import { onRequestError } from '@/instrumentation';

const request = {
  path: '/dashboard',
  method: 'GET',
  headers: { 'user-agent': 'vitest' },
};

const context = {
  routerKind: 'App Router' as const,
  routePath: '/dashboard',
  routeType: 'render' as const,
  revalidateReason: undefined,
};

describe('onRequestError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs the error with request metadata', async () => {
    const err = new Error('boom');

    await onRequestError(err, request, context);

    expect(logger.error).toHaveBeenCalledWith(
      { err, path: '/dashboard', method: 'GET' },
      'Unhandled request error',
    );
  });

  it('forwards the error to Sentry with the context Next supplies', async () => {
    const err = new Error('boom');

    await onRequestError(err, request, context);

    expect(captureRequestError).toHaveBeenCalledWith(err, request, context);
  });
});
