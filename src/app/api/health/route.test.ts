import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryRaw, getValue, error } = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  getValue: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/server/db/client', () => ({
  default: { $queryRaw: (...a: unknown[]) => queryRaw(...a) },
}));
vi.mock('@/server/redis', () => ({
  getValue: (...a: unknown[]) => getValue(...a),
}));
vi.mock('@/server/logging/logger', () => ({
  default: { error: (...a: unknown[]) => error(...a) },
}));

import { GET } from '@/app/api/health/route';

const call = (url: string) => GET(new Request(url));

beforeEach(() => {
  vi.clearAllMocks();
  queryRaw.mockResolvedValue([{ '?column?': 1 }]);
  getValue.mockResolvedValue(null);
});

describe('shallow check', () => {
  // A 3-minute uptime monitor runs this one; a database touch here would keep
  // Neon's compute from ever scaling to zero.
  it('returns ok without touching any dependency', async () => {
    const response = await call('http://localhost:3000/api/health');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'ok' });
    expect(queryRaw).not.toHaveBeenCalled();
    expect(getValue).not.toHaveBeenCalled();
  });

  it('is not cached', async () => {
    const response = await call('http://localhost:3000/api/health');

    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('stays shallow for a falsy deep param', async () => {
    const response = await call('http://localhost:3000/api/health?deep=0');

    await expect(response.json()).resolves.toEqual({ status: 'ok' });
    expect(queryRaw).not.toHaveBeenCalled();
  });
});

describe('deep check', () => {
  it('probes both dependencies and reports each', async () => {
    const response = await call('http://localhost:3000/api/health?deep=1');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: 'ok',
      checks: { db: 'ok', redis: 'ok' },
    });
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(getValue).toHaveBeenCalledWith('health:probe');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('names the failing dependency when the database is down', async () => {
    queryRaw.mockRejectedValue(new Error('connection refused'));

    const response = await call('http://localhost:3000/api/health?deep=1');

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

    const response = await call('http://localhost:3000/api/health?deep=1');

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      status: 'unhealthy',
      checks: { db: 'ok', redis: 'fail' },
    });
  });

  it('reports both as failed rather than only the first rejection', async () => {
    queryRaw.mockRejectedValue(new Error('connection refused'));
    getValue.mockRejectedValue(new Error('upstash unreachable'));

    const response = await call('http://localhost:3000/api/health?deep=1');

    await expect(response.json()).resolves.toEqual({
      status: 'unhealthy',
      checks: { db: 'fail', redis: 'fail' },
    });
    expect(error).toHaveBeenCalledTimes(2);
  });
});
