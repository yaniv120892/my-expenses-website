import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { ApiTokenScope } from '@/shared/types/apiToken';

const { authenticateApiToken, requireUser } = vi.hoisted(() => ({
  authenticateApiToken: vi.fn(),
  requireUser: vi.fn(),
}));

vi.mock('@/server/auth/apiTokens', async () => ({
  ...(await vi.importActual<typeof import('@/server/auth/apiTokens')>(
    '@/server/auth/apiTokens',
  )),
  authenticateApiToken,
}));
vi.mock('@/server/auth/session', async () => ({
  ...(await vi.importActual<typeof import('@/server/auth/session')>(
    '@/server/auth/session',
  )),
  requireUser,
}));
vi.mock('@/server/logging/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('@/server/logging/betterStackStream', () => ({
  flushRemoteLogs: vi.fn(),
  betterStackStream: { write: vi.fn() },
}));
vi.mock('next/server', async () => ({
  ...(await vi.importActual<typeof import('next/server')>('next/server')),
  after: vi.fn(),
}));

import { createHandler } from '@/server/http/handler';

const ROUTE_CONTEXT = { params: Promise.resolve({}) };
const TOKEN_OWNER = '22222222-2222-4222-8222-222222222222';

function request(authorization: string, cookie?: string): NextRequest {
  return new NextRequest('http://localhost/api/imports', {
    headers: { authorization, ...(cookie && { cookie }) },
  });
}

function echoUserRoute(apiTokenScope?: ApiTokenScope) {
  return createHandler({
    auth: 'session',
    apiTokenScope,
    handler: async ({ userId }) => ({ userId }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createHandler API token auth', () => {
  it("checks an API token against the route's scope", async () => {
    authenticateApiToken.mockResolvedValue({
      userId: TOKEN_OWNER,
      apiTokenId: 'token-id',
    });

    const response = await echoUserRoute('IMPORTS')(
      request('Bearer mxk_secret'),
      ROUTE_CONTEXT,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ userId: TOKEN_OWNER });
    expect(authenticateApiToken).toHaveBeenCalledWith('mxk_secret', 'IMPORTS');
    expect(requireUser).not.toHaveBeenCalled();
  });

  it('refuses an API token on a route that declares no scope', async () => {
    const response = await echoUserRoute()(
      request('Bearer mxk_secret'),
      ROUTE_CONTEXT,
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      code: 'API_TOKEN_NOT_ACCEPTED',
    });
    expect(authenticateApiToken).not.toHaveBeenCalled();
  });

  it('lets a session cookie win over an API token bearer', async () => {
    requireUser.mockResolvedValue('session-user');

    const response = await echoUserRoute()(
      request('Bearer mxk_secret', 'session=browser-jwt'),
      ROUTE_CONTEXT,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ userId: 'session-user' });
    expect(authenticateApiToken).not.toHaveBeenCalled();
  });

  it('treats an empty session cookie as absent, as requireUser does', async () => {
    authenticateApiToken.mockResolvedValue({
      userId: TOKEN_OWNER,
      apiTokenId: 'token-id',
    });

    const response = await echoUserRoute('IMPORTS')(
      request('Bearer mxk_secret', 'session='),
      ROUTE_CONTEXT,
    );

    expect(await response.json()).toEqual({ userId: TOKEN_OWNER });
    expect(requireUser).not.toHaveBeenCalled();
  });

  it('never reads an API token from the session cookie', async () => {
    requireUser.mockResolvedValue('session-user');

    const response = await echoUserRoute('IMPORTS')(
      new NextRequest('http://localhost/api/imports', {
        headers: { cookie: 'session=mxk_planted' },
      }),
      ROUTE_CONTEXT,
    );

    expect(await response.json()).toEqual({ userId: 'session-user' });
    expect(requireUser).toHaveBeenCalled();
    expect(authenticateApiToken).not.toHaveBeenCalled();
  });

  it('still takes a session bearer on a route that declares a scope', async () => {
    requireUser.mockResolvedValue('session-user');

    const response = await echoUserRoute('IMPORTS')(
      request('Bearer eyJhbGciOi.session.jwt'),
      ROUTE_CONTEXT,
    );

    expect(await response.json()).toEqual({ userId: 'session-user' });
    expect(authenticateApiToken).not.toHaveBeenCalled();
  });
});
