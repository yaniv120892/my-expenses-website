import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryRaw, getValue, error } = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  getValue: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/server/db/client', () => ({ default: { $queryRaw: queryRaw } }));
vi.mock('@/server/redis', () => ({ getValue }));
vi.mock('@/server/logging/logger', () => ({ default: { error } }));

import { GET } from '@/app/api/health/route';

const call = (query = '') =>
  GET(new NextRequest(`http://localhost:3000/api/health${query}`));

beforeEach(() => {
  vi.clearAllMocks();
  queryRaw.mockResolvedValue([{ '?column?': 1 }]);
  getValue.mockResolvedValue(null);
});

describe('shallow check', () => {
  it('returns an uncached ok without touching any dependency', async () => {
    const response = await call();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'ok' });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(queryRaw).not.toHaveBeenCalled();
    expect(getValue).not.toHaveBeenCalled();
  });
});

describe('deep check', () => {
  it('probes both dependencies and reports each', async () => {
    const response = await call('?deep=1');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: 'ok',
      checks: { db: 'ok', redis: 'ok' },
    });
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(getValue).toHaveBeenCalledWith('health:probe');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('accepts deep=true as well as deep=1', async () => {
    await call('?deep=true');

    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  // A stray param on the 3-minute shallow monitor must not start probing
  // Postgres on every poll — that is the CU-hour blowout this design prevents.
  it.each(['?deep=0', '?deep=false', '?deep'])(
    'stays shallow for %s',
    async (query) => {
      const response = await call(query);

      await expect(response.json()).resolves.toEqual({ status: 'ok' });
      expect(queryRaw).not.toHaveBeenCalled();
    },
  );

  it('fails a dependency that hangs instead of hanging the request', async () => {
    vi.useFakeTimers();
    getValue.mockReturnValue(new Promise(() => {}));

    const pending = call('?deep=1');
    await vi.advanceTimersByTimeAsync(5000);
    const response = await pending;

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      status: 'unhealthy',
      checks: { db: 'ok', redis: 'fail' },
    });
    vi.useRealTimers();
  });

  it('names the failing dependency when the database is down', async () => {
    queryRaw.mockRejectedValue(new Error('connection refused'));

    const response = await call('?deep=1');

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      status: 'unhealthy',
      checks: { db: 'fail', redis: 'ok' },
    });
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ check: 'db' }),
      'Health check failed',
    );
  });

  it('names the failing dependency when redis is down', async () => {
    getValue.mockRejectedValue(new Error('upstash unreachable'));

    const response = await call('?deep=1');

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      status: 'unhealthy',
      checks: { db: 'ok', redis: 'fail' },
    });
  });

  it('reports both as failed rather than only the first rejection', async () => {
    queryRaw.mockRejectedValue(new Error('connection refused'));
    getValue.mockRejectedValue(new Error('upstash unreachable'));

    const response = await call('?deep=1');

    await expect(response.json()).resolves.toEqual({
      status: 'unhealthy',
      checks: { db: 'fail', redis: 'fail' },
    });
    expect(error).toHaveBeenCalledTimes(2);
  });
});
