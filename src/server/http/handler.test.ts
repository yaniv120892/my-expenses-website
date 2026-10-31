import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { pingHeartbeat, loggerMock, flushRemoteLogs, calls } = vi.hoisted(() => {
  const calls: string[] = [];
  return {
    calls,
    pingHeartbeat: vi.fn(() => {
      calls.push('ping');
    }),
    loggerMock: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
    flushRemoteLogs: vi.fn(async () => {
      calls.push('flush');
    }),
  };
});

vi.mock('@/server/observability', () => ({
  logger: loggerMock,
  observability: { pingHeartbeat, flushRemoteLogs, scheduleOpsAlert: vi.fn() },
}));

import { createHandler } from '@/server/http/handler';

const HEARTBEAT_ENV_VAR = 'BETTERSTACK_HEARTBEAT_SUMMARY_TODAY';

const ROUTE_CONTEXT = { params: Promise.resolve({}) };

function request(): NextRequest {
  return new NextRequest('http://localhost/api/summary/today', {
    headers: { authorization: 'Bearer cron-secret' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  process.env.CRON_SECRET = 'cron-secret';
});

describe('createHandler heartbeat', () => {
  it('pings after a successful run', async () => {
    const route = createHandler({
      auth: 'cron',
      heartbeatEnvVar: HEARTBEAT_ENV_VAR,
      handler: async () => ({ sent: 1 }),
    });

    const response = await route(request(), ROUTE_CONTEXT);

    expect(response.status).toBe(200);
    expect(pingHeartbeat).toHaveBeenCalledWith(HEARTBEAT_ENV_VAR);
  });

  it('does not ping when the handler throws', async () => {
    const route = createHandler({
      auth: 'cron',
      heartbeatEnvVar: HEARTBEAT_ENV_VAR,
      handler: async () => {
        throw new Error('partial failure');
      },
    });

    const response = await route(request(), ROUTE_CONTEXT);

    expect(response.status).toBe(500);
    expect(pingHeartbeat).not.toHaveBeenCalled();
    expect(loggerMock.error).toHaveBeenCalled();
  });

  it('does not ping when a thrown error carries a success status', async () => {
    const route = createHandler({
      auth: 'cron',
      heartbeatEnvVar: HEARTBEAT_ENV_VAR,
      handler: async () => {
        throw Object.assign(new Error('partial failure'), { status: 200 });
      },
    });

    const response = await route(request(), ROUTE_CONTEXT);

    expect(response.status).toBe(500);
    expect(pingHeartbeat).not.toHaveBeenCalled();
  });

  it('does not ping a route that declares no heartbeat env var', async () => {
    const route = createHandler({
      auth: 'cron',
      handler: async () => ({ ok: true }),
    });

    await route(request(), ROUTE_CONTEXT);

    expect(pingHeartbeat).not.toHaveBeenCalled();
  });

  it('ships the run record before the ping can hang', async () => {
    const route = createHandler({
      auth: 'cron',
      heartbeatEnvVar: HEARTBEAT_ENV_VAR,
      handler: async () => ({ sent: 1 }),
    });

    await route(request(), ROUTE_CONTEXT);

    expect(calls).toEqual(['flush', 'ping']);
  });
});

describe('createHandler request log', () => {
  function requestLine(): Record<string, unknown> {
    const call = loggerMock.info.mock.calls.find(([, message]) => message === 'request');
    if (!call) {
      throw new Error('no request line was logged');
    }
    return call[0];
  }

  it('marks a cron request line for shipping', async () => {
    const route = createHandler({
      auth: 'cron',
      handler: async () => ({ ok: true }),
    });

    await route(request(), ROUTE_CONTEXT);

    expect(requestLine()).toMatchObject({ status: 200, ship: true });
  });

  it('leaves a non-cron request line unmarked', async () => {
    const route = createHandler({
      auth: 'public',
      rateLimit: 'none',
      handler: async () => ({ ok: true }),
    });

    await route(request(), ROUTE_CONTEXT);

    expect(requestLine().ship).toBeUndefined();
  });
});

describe('createHandler secret auth', () => {
  const withHeaders = (headers: Record<string, string>) =>
    new NextRequest('http://localhost/api/summary/today', { headers });

  it.each([
    ['a wrong cron secret of the same length', 'Bearer cron-secreT'],
    ['a cron secret of a different length', 'Bearer x'],
  ])('401s %s', async (_label, authorization) => {
    const route = createHandler({
      auth: 'cron',
      handler: async () => ({ ok: true }),
    });

    const response = await route(withHeaders({ authorization }), ROUTE_CONTEXT);

    expect(response.status).toBe(401);
  });

  it('401s a telegram call whose secret header differs in length', async () => {
    process.env.TELEGRAM_WEBHOOK_SECRET = 'telegram-secret';
    const route = createHandler({
      auth: 'telegram',
      handler: async () => ({ ok: true }),
    });

    const rejected = await route(
      withHeaders({ 'x-telegram-bot-api-secret-token': 'nope' }),
      ROUTE_CONTEXT,
    );
    const accepted = await route(
      withHeaders({ 'x-telegram-bot-api-secret-token': 'telegram-secret' }),
      ROUTE_CONTEXT,
    );

    expect(rejected.status).toBe(401);
    expect(accepted.status).toBe(200);
  });
});

describe('createHandler form body', () => {
  const route = createHandler({
    auth: 'public',
    rateLimit: 'none',
    handler: async ({ request }) => ({ name: (await request.formData()).get('name') }),
  });

  function post(init: { body: BodyInit; headers?: Record<string, string> }): NextRequest {
    return new NextRequest('http://localhost/api/form', { method: 'POST', ...init });
  }

  it('answers 400 when a form route is sent JSON', async () => {
    const response = await route(
      post({
        body: JSON.stringify({ name: 'x' }),
        headers: { 'content-type': 'application/json' },
      }),
      ROUTE_CONTEXT,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      message: 'Invalid form body: expected multipart/form-data',
    });
    expect(loggerMock.error).not.toHaveBeenCalled();
  });

  it('answers 400 when a multipart body is cut short', async () => {
    const response = await route(
      post({
        body: '--boundary\r\nContent-Disposition: form-data; name="name"\r\n\r\nx',
        headers: { 'content-type': 'multipart/form-data; boundary=boundary' },
      }),
      ROUTE_CONTEXT,
    );

    expect(response.status).toBe(400);
  });

  it('still reads a well-formed form', async () => {
    const form = new FormData();
    form.append('name', 'x');

    const response = await route(post({ body: form }), ROUTE_CONTEXT);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ name: 'x' });
  });
});
