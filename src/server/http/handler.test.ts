import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { pingHeartbeat, loggerMock, after, flushRemoteLogs, calls } = vi.hoisted(
  () => {
    const calls: string[] = [];
    return {
      calls,
      pingHeartbeat: vi.fn(() => {
        calls.push('ping');
      }),
      loggerMock: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
      after: vi.fn(),
      flushRemoteLogs: vi.fn(async () => {
        calls.push('flush');
      }),
    };
  },
);

vi.mock('@/server/monitoring/heartbeat', () => ({ pingHeartbeat }));
vi.mock('@/server/logging/betterStackStream', () => ({
  flushRemoteLogs,
  betterStackStream: { write: vi.fn() },
}));
vi.mock('@/server/logging/logger', () => ({ default: loggerMock }));
// `after` throws outside a request scope, which is where these tests call the
// handler.
vi.mock('next/server', async () => ({
  ...(await vi.importActual<typeof import('next/server')>('next/server')),
  after,
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
    const call = loggerMock.info.mock.calls.find(
      ([, msg]) => msg === 'request',
    );
    return call?.[0] as Record<string, unknown>;
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
