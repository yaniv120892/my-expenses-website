import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { logger, captureException, scheduleOpsAlert } = vi.hoisted(() => ({
  logger: { error: vi.fn(), info: vi.fn() },
  captureException: vi.fn(),
  scheduleOpsAlert: vi.fn(),
}));

vi.mock('@/server/observability', () => ({ logger, observability: { scheduleOpsAlert } }));
vi.mock('@sentry/nextjs', () => ({ captureException }));

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

  it('reports a 500 to Sentry as well as the log', async () => {
    const err = new Error('boom');
    const handler = createHandler({
      auth: 'public',
      rateLimit: 'none',
      handler: async () => {
        throw err;
      },
    });

    const response = await handler(get(), routeContext);

    expect(response.status).toBe(500);
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(captureException).toHaveBeenCalledWith(err, expect.anything());
  });

  it('alerts the owner on a 500, counted per route pattern rather than per id', async () => {
    const err = new Error('boom');
    const handler = createHandler({
      auth: 'public',
      rateLimit: 'none',
      handler: async () => {
        throw err;
      },
    });
    const transactionId = '0b6f2c64-5d6f-4a43-9c55-6a1f7b3e2d10';

    await handler(new NextRequest(`https://website.localhost/api/transactions/${transactionId}`), {
      params: Promise.resolve({ id: transactionId }),
    });

    expect(scheduleOpsAlert).toHaveBeenCalledWith({
      alertType: '5xx GET /api/transactions/[id]',
      title: `5xx on GET /api/transactions/${transactionId}`,
      error: err,
      context: { requestId: expect.any(String) },
    });
  });

  it('does not alert on a client error', async () => {
    const handler = createHandler({
      auth: 'public',
      rateLimit: 'none',
      handler: async () => {
        throw new HttpError(404, 'Not found');
      },
    });

    await handler(get(), routeContext);

    expect(scheduleOpsAlert).not.toHaveBeenCalled();
  });

  it('does not report a client error', async () => {
    const handler = createHandler({
      auth: 'public',
      rateLimit: 'none',
      handler: async () => {
        throw new HttpError(404, 'Not found');
      },
    });

    const response = await handler(get(), routeContext);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ message: 'Not found' });
    expect(captureException).not.toHaveBeenCalled();
  });
});

describe('createHandler error responses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function routeThrowing(err: unknown) {
    return createHandler({
      auth: 'public',
      rateLimit: 'none',
      handler: async () => {
        throw err;
      },
    });
  }

  it.each([
    ['a plain Error', new Error('Missing required environment variable: SMTP_PASS')],
    [
      'a non-Prisma code-bearing error',
      Object.assign(new Error('connect ECONNREFUSED'), {
        code: 'ECONNREFUSED',
      }),
    ],
    [
      'an object carrying an upstream status',
      Object.assign(new Error('Request failed with status code 429'), {
        status: 429,
      }),
    ],
  ])('answers %s with a neutral 500', async (_label, err) => {
    const response = await routeThrowing(err)(get(), routeContext);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ message: 'Internal Server Error' });
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['P2025', 404, 'Not found'],
    ['P2002', 409, 'Already exists'],
    ['P2003', 400, 'Invalid reference'],
    ['P2023', 400, 'Invalid identifier'],
  ])('maps Prisma %s to %i', async (code, status, message) => {
    const err = Object.assign(new Error('Invalid `prisma.transaction.update()` invocation'), {
      code,
    });

    const response = await routeThrowing(err)(get(), routeContext);

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ message });
    expect(logger.error).not.toHaveBeenCalled();
    expect(captureException).not.toHaveBeenCalled();
  });

  it('keeps Prisma failures on machine routes as alerting 500s', async () => {
    process.env.CRON_SECRET = 'cron-secret';
    const handler = createHandler({
      auth: 'cron',
      handler: async () => {
        throw Object.assign(new Error('no row'), { code: 'P2025' });
      },
    });
    const request = new NextRequest('https://website.localhost/api/thing', {
      headers: { authorization: 'Bearer cron-secret' },
    });

    const response = await handler(request, routeContext);

    expect(response.status).toBe(500);
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(captureException).toHaveBeenCalledTimes(1);
  });
});

describe('createHandler params validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const echoParams = createHandler({
    auth: 'public',
    rateLimit: 'none',
    handler: async ({ params }) => ({ received: params }),
  });

  it.each([
    ['an RFC 9562 uuid', '3f2f1a10-6a37-4dc5-9c5e-1f8a5f4d2b6a'],
    ['a seeded category id without RFC 9562 version bits', 'a6b7c8d9-6e7f-8a9b-3c4d-4e5f6a7b8c9d'],
  ])('passes %s through by default', async (_label, id) => {
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
      rateLimit: 'none',
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

describe('createHandler body validation', () => {
  it('answers an invalid body with every issue in one message', async () => {
    const handler = createHandler({
      auth: 'public',
      rateLimit: 'none',
      bodySchema: z.object({
        description: z.string(),
        items: z.array(z.object({ value: z.number() })),
      }),
      handler: async () => ({}),
    });
    const response = await handler(
      new NextRequest('https://website.localhost/api/thing', {
        method: 'POST',
        body: JSON.stringify({ items: [{ value: 'x' }] }),
      }),
      routeContext,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      message:
        'description: Invalid input: expected string, received undefined; items.0.value: Invalid input: expected number, received string',
    });
  });
});
