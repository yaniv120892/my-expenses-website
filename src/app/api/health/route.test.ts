import { describe, expect, it, vi } from 'vitest';

const { queryRaw, getValue } = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  getValue: vi.fn(),
}));

vi.mock('@/server/db/client', () => ({ default: { $queryRaw: queryRaw } }));
vi.mock('@/server/redis', () => ({ getValue }));

import { GET } from '@/app/api/health/route';

describe('shallow check', () => {
  // The 3-minute monitor polls this one; a dependency call here is what would
  // stop Neon from ever scaling to zero.
  it('returns an uncached ok without touching any dependency', async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'ok' });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(queryRaw).not.toHaveBeenCalled();
    expect(getValue).not.toHaveBeenCalled();
  });
});
