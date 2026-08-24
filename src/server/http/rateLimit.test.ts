import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { incrementWithTtl, logger } = vi.hoisted(() => ({
  incrementWithTtl: vi.fn(),
  logger: { error: vi.fn(), info: vi.fn() },
}));

vi.mock('@/server/redis', () => ({ incrementWithTtl }));
vi.mock('@/server/logging/logger', () => ({ default: logger }));

import { enforceRateLimit, clientIp } from '@/server/http/rateLimit';
import { HttpError } from '@/server/http/errors';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('enforceRateLimit', () => {
  it('allows requests under the limit', async () => {
    incrementWithTtl.mockResolvedValue(3);

    await expect(
      enforceRateLimit('login:1.2.3.4', 5, 60),
    ).resolves.toBeUndefined();
    expect(incrementWithTtl).toHaveBeenCalledWith(
      'rateLimit:login:1.2.3.4',
      60,
    );
  });

  it('throws 429 once the limit is exceeded', async () => {
    incrementWithTtl.mockResolvedValue(6);

    await expect(
      enforceRateLimit('login:1.2.3.4', 5, 60),
    ).rejects.toMatchObject({ status: 429 });
    await expect(
      enforceRateLimit('login:1.2.3.4', 5, 60),
    ).rejects.toBeInstanceOf(HttpError);
  });

  it('fails open with a logged error when Redis is down', async () => {
    incrementWithTtl.mockRejectedValue(new Error('connect ECONNREFUSED'));

    await expect(
      enforceRateLimit('login:1.2.3.4', 5, 60),
    ).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledTimes(1);
  });
});

describe('clientIp', () => {
  it('takes the first x-forwarded-for entry', () => {
    const request = new NextRequest('https://website.localhost/api/thing', {
      headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' },
    });

    expect(clientIp(request)).toBe('203.0.113.9');
  });

  it('falls back when the header is absent', () => {
    const request = new NextRequest('https://website.localhost/api/thing');

    expect(clientIp(request)).toBe('unknown');
  });
});
