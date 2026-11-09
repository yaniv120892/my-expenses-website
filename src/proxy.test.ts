import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';
import { signToken } from '@/server/auth/tokens';

function mcpPost(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('https://expenses.example/api/mcp', {
    method: 'POST',
    headers: { host: 'expenses.example', ...headers },
  });
}

// A remote agent has no session cookie and, being server-side, sends no
// Origin; it must reach the route's own bearer check, never a login redirect.
describe('proxy on /api/mcp', () => {
  it('passes a cookieless server-side POST through to the route', async () => {
    const response = await proxy(mcpPost({ authorization: 'Bearer mxk_x' }));

    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(response.headers.get('location')).toBeNull();
  });

  it('still rejects a cross-origin browser POST', async () => {
    const response = await proxy(mcpPost({ origin: 'https://evil.example' }));

    expect(response.status).toBe(403);
  });
});

describe('proxy on /reset-password', () => {
  function pageRequest(path: string, sessionToken?: string): NextRequest {
    return new NextRequest(`https://expenses.example${path}`, {
      headers: sessionToken ? { cookie: `session=${sessionToken}` } : {},
    });
  }

  // Regression: the page was an auth page, so a browser still signed in was
  // sent to the dashboard and the emailed link's token was lost.
  it('serves the page to a browser that still holds a session', async () => {
    vi.stubEnv('JWT_SECRET', 'proxy-test-secret');
    onTestFinished(() => {
      vi.unstubAllEnvs();
    });

    const response = await proxy(
      pageRequest('/reset-password', await signToken({ userId: 'user-1', tokenVersion: 0 })),
    );

    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(response.headers.get('location')).toBeNull();
  });

  it('serves the page to a signed-out browser', async () => {
    const response = await proxy(pageRequest('/reset-password'));

    expect(response.headers.get('location')).toBeNull();
  });
});

describe('proxy on an invite link', () => {
  it('sends a signed-out visitor to login with the link to come back to', async () => {
    const response = await proxy(
      new NextRequest('https://expenses.example/join?code=ABCD2345', {
        headers: { host: 'expenses.example' },
      }),
    );

    expect(response.headers.get('location')).toBe(
      'https://expenses.example/login?next=%2Fjoin%3Fcode%3DABCD2345',
    );
  });

  it('sends a signed-out visitor elsewhere to plain login', async () => {
    const response = await proxy(
      new NextRequest('https://expenses.example/dashboard', {
        headers: { host: 'expenses.example' },
      }),
    );

    expect(response.headers.get('location')).toBe('https://expenses.example/login');
  });
});
