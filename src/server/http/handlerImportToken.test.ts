import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { authenticate, requireUser } = vi.hoisted(() => ({
  authenticate: vi.fn(),
  requireUser: vi.fn(),
}));

vi.mock('@/server/auth/importTokens', async () => ({
  ...(await vi.importActual<typeof import('@/server/auth/importTokens')>(
    '@/server/auth/importTokens',
  )),
  importTokenService: { authenticate },
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

function request(authorization: string): NextRequest {
  return new NextRequest('http://localhost/api/imports', {
    headers: { authorization },
  });
}

function echoUserRoute(acceptsImportToken: boolean) {
  return createHandler({
    auth: 'session',
    acceptsImportToken,
    handler: async ({ userId }) => ({ userId }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createHandler import token auth', () => {
  it('admits an import token on a route that accepts one', async () => {
    authenticate.mockResolvedValue(TOKEN_OWNER);

    const response = await echoUserRoute(true)(
      request('Bearer mxi_secret'),
      ROUTE_CONTEXT,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ userId: TOKEN_OWNER });
    expect(authenticate).toHaveBeenCalledWith('mxi_secret');
    expect(requireUser).not.toHaveBeenCalled();
  });

  it('refuses an import token on every other session route', async () => {
    const response = await echoUserRoute(false)(
      request('Bearer mxi_secret'),
      ROUTE_CONTEXT,
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      code: 'IMPORT_TOKEN_NOT_ACCEPTED',
    });
    expect(authenticate).not.toHaveBeenCalled();
  });

  it('still takes a session bearer on a route that accepts import tokens', async () => {
    requireUser.mockResolvedValue('session-user');

    const response = await echoUserRoute(true)(
      request('Bearer eyJhbGciOi.session.jwt'),
      ROUTE_CONTEXT,
    );

    expect(await response.json()).toEqual({ userId: 'session-user' });
    expect(authenticate).not.toHaveBeenCalled();
  });
});
