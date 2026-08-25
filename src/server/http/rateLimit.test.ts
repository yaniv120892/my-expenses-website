import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { incrementManyWithTtl, logger } = vi.hoisted(() => ({
  incrementManyWithTtl: vi.fn(),
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock('@/server/redis', () => ({ incrementManyWithTtl }));
vi.mock('@/server/logging/logger', () => ({ default: logger }));

import { enforceRateLimits, resolveClientIp } from '@/server/http/rateLimit';

const LOGIN_RULE = { key: 'login:ip:1.2.3.4', limit: 5, windowSeconds: 60 };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('enforceRateLimits', () => {
  it('allows requests under every limit', async () => {
    incrementManyWithTtl.mockResolvedValue([3, 1]);

    await expect(
      enforceRateLimits([
        LOGIN_RULE,
        { key: 'login:email:a@b.c', limit: 5, windowSeconds: 60 },
      ]),
    ).resolves.toBeUndefined();
    expect(incrementManyWithTtl).toHaveBeenCalledWith([
      { key: 'rateLimit:login:ip:1.2.3.4', ttlSeconds: 60 },
      { key: 'rateLimit:login:email:a@b.c', ttlSeconds: 60 },
    ]);
  });

  it('throws 429 and warns once any limit is exceeded', async () => {
    incrementManyWithTtl.mockResolvedValue([6]);

    await expect(enforceRateLimits([LOGIN_RULE])).rejects.toMatchObject({
      status: 429,
      message: 'Too many requests. Try again later.',
    });
    // warn ships to Better Stack; the attack stays visible past Vercel's
    // one-hour log retention.
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('fails open with a logged error when Redis is down', async () => {
    incrementManyWithTtl.mockRejectedValue(new Error('connect ECONNREFUSED'));

    await expect(enforceRateLimits([LOGIN_RULE])).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('skips Redis entirely for an empty rule list', async () => {
    await enforceRateLimits([]);

    expect(incrementManyWithTtl).not.toHaveBeenCalled();
  });
});

describe('resolveClientIp', () => {
  it('prefers the platform-set x-vercel-forwarded-for', () => {
    const request = new NextRequest('https://website.localhost/api/thing', {
      headers: {
        'x-vercel-forwarded-for': '203.0.113.9',
        'x-forwarded-for': '198.51.100.7',
      },
    });

    expect(resolveClientIp(request)).toBe('203.0.113.9');
  });

  it('takes the first x-forwarded-for entry as the fallback', () => {
    const request = new NextRequest('https://website.localhost/api/thing', {
      headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' },
    });

    expect(resolveClientIp(request)).toBe('203.0.113.9');
  });

  it('falls back when neither header is present', () => {
    const request = new NextRequest('https://website.localhost/api/thing');

    expect(resolveClientIp(request)).toBe('unknown');
  });
});
