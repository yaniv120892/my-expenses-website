import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as DeepHealthRouteModule from '@/app/api/health/deep/route';

const { queryRaw, getValue } = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  getValue: vi.fn(),
}));

vi.mock('@/server/db/client', () => ({ default: { $queryRaw: queryRaw } }));
vi.mock('@/server/redis', () => ({ getValue, incrementWithTtl: vi.fn() }));

// The route caches its outcome for 60s, so each test loads a fresh copy.
let GET: typeof DeepHealthRouteModule.GET;

beforeEach(async () => {
  vi.resetModules();
  ({ GET } = await import('@/app/api/health/deep/route'));
  vi.clearAllMocks();
  queryRaw.mockResolvedValue([{ '?column?': 1 }]);
  getValue.mockResolvedValue(null);
});

describe('deep check', () => {
  it('probes the database and redis and reports each', async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: 'ok',
      checks: { db: 'ok', redis: 'ok' },
      checkedAt: expect.any(String),
    });
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(getValue).toHaveBeenCalledWith('health:probe');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('names the database when it is down', async () => {
    queryRaw.mockRejectedValue(new Error('connection refused'));

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      status: 'unhealthy',
      checks: { db: 'fail', redis: 'ok' },
      checkedAt: expect.any(String),
    });
  });

  it('names redis when it is down', async () => {
    getValue.mockRejectedValue(new Error('upstash unreachable'));

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      status: 'unhealthy',
      checks: { db: 'ok', redis: 'fail' },
      checkedAt: expect.any(String),
    });
  });
});
