import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { logger, captureException } = vi.hoisted(() => ({
  logger: { error: vi.fn(), info: vi.fn() },
  captureException: vi.fn(),
}));

vi.mock('@/server/logging/logger', () => ({ default: logger }));
vi.mock('@sentry/nextjs', () => ({ captureException }));

// Calling the handler directly puts us outside a request scope, where the real
// `after` throws; the log flush it defers is not what these tests are about.
vi.mock('next/server', async () => ({
  ...(await vi.importActual<typeof import('next/server')>('next/server')),
  after: vi.fn(),
}));

import { createHandler } from '@/server/http/handler';
import { HttpError } from '@/server/http/errors';

function get(): NextRequest {
  return new NextRequest('https://website.localhost/api/thing');
}

const routeContext = { params: Promise.resolve({}) };

describe('createHandler error reporting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // createHandler turns a thrown error into a response, so Next's
  // onRequestError never sees it — this is the only path to Sentry.
  it('reports a 500 to Sentry as well as the log', async () => {
    const err = new Error('boom');
    const handler = createHandler({
      auth: 'public',
      handler: async () => {
        throw err;
      },
    });

    const response = await handler(get(), routeContext);

    expect(response.status).toBe(500);
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(captureException).toHaveBeenCalledWith(err, expect.anything());
  });

  it('does not report a client error', async () => {
    const handler = createHandler({
      auth: 'public',
      handler: async () => {
        throw new HttpError(404, 'Not found');
      },
    });

    const response = await handler(get(), routeContext);

    expect(response.status).toBe(404);
    expect(captureException).not.toHaveBeenCalled();
  });
});
