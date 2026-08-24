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

import { z } from 'zod';
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

describe('createHandler params validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const echoParams = createHandler({
    auth: 'public',
    handler: async ({ params }) => ({ received: params }),
  });

  it('passes uuid params through by default', async () => {
    const id = '3f2f1a10-6a37-4dc5-9c5e-1f8a5f4d2b6a';
    const response = await echoParams(get(), {
      params: Promise.resolve({ id }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: { id } });
  });

  it('rejects a malformed id with a schema 400, not a Prisma 500', async () => {
    const response = await echoParams(get(), {
      params: Promise.resolve({ id: 'not-a-uuid' }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ message: 'id: Invalid uuid' });
    expect(logger.error).not.toHaveBeenCalled();
    expect(captureException).not.toHaveBeenCalled();
  });

  it('accepts a static route with no params', async () => {
    const response = await echoParams(get(), routeContext);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: {} });
  });

  it('accepts a static route whose params promise resolves undefined', async () => {
    // What Next actually passes for a static route — not an empty object.
    const response = await echoParams(get(), {
      params: Promise.resolve(undefined),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: {} });
  });

  it('lets a route opt out of uuid validation with its own schema', async () => {
    const handler = createHandler({
      auth: 'public',
      paramsSchema: z.object({ slug: z.string().min(1) }),
      handler: async ({ params }) => ({ slug: params.slug }),
    });

    const response = await handler(get(), {
      params: Promise.resolve({ slug: 'monthly-report' }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ slug: 'monthly-report' });
  });
});
