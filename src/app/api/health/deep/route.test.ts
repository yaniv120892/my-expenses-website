import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryRaw, getValue, error } = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  getValue: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/server/db/client', () => ({ default: { $queryRaw: queryRaw } }));
vi.mock('@/server/redis', () => ({ getValue }));
vi.mock('@/server/logging/logger', () => ({ default: { error } }));

import { GET } from '@/app/api/health/deep/route';

beforeEach(() => {
  vi.clearAllMocks();
  queryRaw.mockResolvedValue([{ '?column?': 1 }]);
  getValue.mockResolvedValue(null);
});

describe('deep check', () => {
  it('probes both dependencies and reports each', async () => {
    const response = await GET();

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

    const response = await GET();

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

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      status: 'unhealthy',
      checks: { db: 'ok', redis: 'fail' },
    });
  });

  it('reports both as failed rather than only the first rejection', async () => {
    queryRaw.mockRejectedValue(new Error('connection refused'));
    getValue.mockRejectedValue(new Error('upstash unreachable'));

    const response = await GET();

    await expect(response.json()).resolves.toEqual({
      status: 'unhealthy',
      checks: { db: 'fail', redis: 'fail' },
    });
    expect(error).toHaveBeenCalledTimes(2);
  });

  it('fails a dependency that hangs instead of hanging the request', async () => {
    vi.useFakeTimers();
    getValue.mockReturnValue(new Promise(() => {}));

    const pending = GET();
    await vi.advanceTimersByTimeAsync(5000);
    const response = await pending;

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      status: 'unhealthy',
      checks: { db: 'ok', redis: 'fail' },
    });
    vi.useRealTimers();
  });
});
