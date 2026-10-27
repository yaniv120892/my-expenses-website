import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as RateLimitModule from '@/server/http/rateLimit';
import type * as NextServerModule from 'next/server';
import { NextRequest } from 'next/server';

const { enforceRateLimits, authService } = vi.hoisted(() => ({
  enforceRateLimits: vi.fn(),
  authService: { loginUser: vi.fn() },
}));

vi.mock('@/server/http/rateLimit', async () => ({
  ...(await vi.importActual<typeof RateLimitModule>('@/server/http/rateLimit')),
  enforceRateLimits,
}));
vi.mock('@/server/services/authService', () => ({ default: authService }));
vi.mock('@/server/observability', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('next/server', async () => ({
  ...(await vi.importActual<typeof NextServerModule>('next/server')),
  after: vi.fn(),
}));

import { POST } from '@/app/api/auth/login/route';

const ROUTE_CONTEXT = { params: Promise.resolve(undefined) };

beforeEach(() => {
  vi.clearAllMocks();
  authService.loginUser.mockResolvedValue({ error: 'Invalid credentials' });
});

describe('POST /api/auth/login', () => {
  it('counts attempts against the username too, which the lookup matches as well as the email', async () => {
    await POST(
      new NextRequest('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'random-1@example.com',
          username: 'Victim@Example.com',
          password: 'guess-1234',
        }),
      }),
      ROUTE_CONTEXT,
    );

    const keys = enforceRateLimits.mock.calls[0]?.[0].map((rule: { key: string }) => rule.key);
    expect(keys).toContain('login:username:victim@example.com');
  });
});
