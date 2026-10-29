import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryRaw, getValue } = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  getValue: vi.fn(),
}));

vi.mock('@/server/db/client', () => ({ default: { $queryRaw: queryRaw } }));
vi.mock('@/server/redis', () => ({ getValue }));

import { GET } from '@/app/api/health/route';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('shallow check', () => {
  it('returns an uncached ok without touching any dependency', async () => {
    const response = GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'ok' });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(queryRaw).not.toHaveBeenCalled();
    expect(getValue).not.toHaveBeenCalled();
  });
});
