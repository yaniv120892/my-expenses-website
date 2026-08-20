import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { pingHeartbeat, loggerMock } = vi.hoisted(() => ({
  pingHeartbeat: vi.fn(),
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/server/monitoring/heartbeat', () => ({ pingHeartbeat }));
vi.mock('@/server/logging/logger', () => ({ default: loggerMock }));

import { createHandler } from '@/server/http/handler';

const ROUTE_CONTEXT = { params: Promise.resolve({}) };

function request(): NextRequest {
  return new NextRequest('http://localhost/api/summary/today', {
    headers: { authorization: 'Bearer cron-secret' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  pingHeartbeat.mockResolvedValue(undefined);
  process.env.CRON_SECRET = 'cron-secret';
});

describe('createHandler heartbeat', () => {
  it('pings after a successful run', async () => {
    const route = createHandler({
      auth: 'cron',
      heartbeat: 'summary-today',
      handler: async () => ({ sent: 1 }),
    });

    const response = await route(request(), ROUTE_CONTEXT);

    expect(response.status).toBe(200);
    expect(pingHeartbeat).toHaveBeenCalledWith('summary-today');
  });

  it('does not ping when the handler throws', async () => {
    const route = createHandler({
      auth: 'cron',
      heartbeat: 'summary-today',
      handler: async () => {
        throw new Error('partial failure');
      },
    });

    const response = await route(request(), ROUTE_CONTEXT);

    expect(response.status).toBe(500);
    expect(pingHeartbeat).not.toHaveBeenCalled();
    expect(loggerMock.error).toHaveBeenCalled();
  });

  it('does not ping a route that declares no heartbeat', async () => {
    const route = createHandler({
      auth: 'cron',
      handler: async () => ({ ok: true }),
    });

    await route(request(), ROUTE_CONTEXT);

    expect(pingHeartbeat).not.toHaveBeenCalled();
  });
});
