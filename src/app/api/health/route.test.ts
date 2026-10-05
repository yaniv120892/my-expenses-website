import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryRaw, getValue, after, flushRemoteLogs } = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  getValue: vi.fn(),
  after: vi.fn(),
  flushRemoteLogs: vi.fn(),
}));

vi.mock('@/server/db/client', () => ({ default: { $queryRaw: queryRaw } }));
vi.mock('@/server/redis', () => ({ getValue }));
vi.mock('@/server/logging/betterStackStream', () => ({ flushRemoteLogs }));
// `after` throws outside a request scope, which is where this test calls the
// handler.
vi.mock('next/server', async () => ({
  ...(await vi.importActual<typeof import('next/server')>('next/server')),
  after,
}));

import { GET } from '@/app/api/health/route';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('shallow check', () => {
  it('returns an uncached ok without touching any dependency', async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'ok' });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(queryRaw).not.toHaveBeenCalled();
    expect(getValue).not.toHaveBeenCalled();
  });

  it('schedules a remote log flush', async () => {
    await GET();

    expect(after).toHaveBeenCalledTimes(1);
    after.mock.calls[0][0]();
    expect(flushRemoteLogs).toHaveBeenCalledTimes(1);
  });
});
