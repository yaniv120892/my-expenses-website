import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as RateLimitModule from '@/server/http/rateLimit';
import type * as NextServerModule from 'next/server';
import { NextRequest } from 'next/server';
import type { ApiTokenScope } from '@/shared/types/apiToken';

const { apiTokenRepository, enforceRateLimits, logger } = vi.hoisted(() => ({
  apiTokenRepository: { findByHash: vi.fn(), markUsed: vi.fn() },
  enforceRateLimits: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/server/repositories/apiTokenRepository', () => ({
  apiTokenRepository,
}));
vi.mock('@/server/http/rateLimit', async () => ({
  ...(await vi.importActual<typeof RateLimitModule>('@/server/http/rateLimit')),
  enforceRateLimits,
}));
vi.mock('@/server/observability', () => ({ logger }));
vi.mock('next/server', async () => ({
  ...(await vi.importActual<typeof NextServerModule>('next/server')),
  after: vi.fn(),
}));

import { DELETE, GET, POST } from '@/app/api/mcp/route';
import { mintApiToken } from '@/server/auth/apiTokenFormat';
import { HttpError } from '@/server/http/errors';

const TOKEN_OWNER = '22222222-2222-4222-8222-222222222222';
const ROUTE_CONTEXT = { params: Promise.resolve(undefined) };
const DAY_MS = 24 * 60 * 60 * 1000;

const INITIALIZE = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'test-agent', version: '1.0.0' },
  },
};

function mcpRequest({
  authorization,
  cookie,
  body = INITIALIZE,
}: {
  authorization?: string;
  cookie?: string;
  body?: unknown;
}): NextRequest {
  return new NextRequest('http://localhost/api/mcp', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      ...(authorization && { authorization }),
      ...(cookie && { cookie }),
    },
    body: JSON.stringify(body),
  });
}

function storedToken({
  scopes = ['AGENT'],
  expiresAt = new Date(Date.now() + DAY_MS),
}: { scopes?: ApiTokenScope[]; expiresAt?: Date } = {}) {
  return {
    id: 'token-id',
    userId: TOKEN_OWNER,
    scopes,
    expiresAt,
    lastUsedAt: new Date(),
  };
}

let token: string;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.JWT_SECRET = 'test-secret';
  token = mintApiToken();
  apiTokenRepository.findByHash.mockResolvedValue(storedToken());
});

async function expectJsonRpcRefusal({
  response,
  status,
  code,
}: {
  response: Response;
  status: number;
  code?: string;
}): Promise<void> {
  expect(response.status).toBe(status);
  expect(response.headers.get('content-type')).toContain('application/json');
  const body = await response.json();
  expect(body).toMatchObject({
    jsonrpc: '2.0',
    id: null,
    error: { code: -32001 },
  });
  if (code) {
    expect(body.error.data).toEqual({ code });
  }
}

describe('POST /api/mcp authentication', () => {
  it('answers a request with no token as a JSON-RPC 401 with a Bearer challenge', async () => {
    const response = await POST(mcpRequest({}), ROUTE_CONTEXT);

    await expectJsonRpcRefusal({
      response,
      status: 401,
      code: 'API_TOKEN_REQUIRED',
    });
    expect(response.headers.get('www-authenticate')).toMatch(/^Bearer /);
    expect(apiTokenRepository.findByHash).not.toHaveBeenCalled();
  });

  it('does not accept a browser session cookie', async () => {
    const response = await POST(mcpRequest({ cookie: 'session=browser-jwt' }), ROUTE_CONTEXT);

    await expectJsonRpcRefusal({
      response,
      status: 401,
      code: 'API_TOKEN_REQUIRED',
    });
  });

  it('does not accept a session JWT as the bearer', async () => {
    const response = await POST(
      mcpRequest({ authorization: 'Bearer eyJhbGciOi.session.jwt' }),
      ROUTE_CONTEXT,
    );

    await expectJsonRpcRefusal({
      response,
      status: 401,
      code: 'API_TOKEN_REQUIRED',
    });
  });

  it('refuses a token without the AGENT scope with a JSON-RPC 403', async () => {
    apiTokenRepository.findByHash.mockResolvedValue(storedToken({ scopes: ['IMPORTS'] }));

    const response = await POST(mcpRequest({ authorization: `Bearer ${token}` }), ROUTE_CONTEXT);

    await expectJsonRpcRefusal({ response, status: 403 });
  });

  it('refuses an expired token', async () => {
    apiTokenRepository.findByHash.mockResolvedValue(
      storedToken({ expiresAt: new Date(Date.now() - DAY_MS) }),
    );

    const response = await POST(mcpRequest({ authorization: `Bearer ${token}` }), ROUTE_CONTEXT);

    await expectJsonRpcRefusal({
      response,
      status: 401,
      code: 'API_TOKEN_EXPIRED',
    });
  });

  it('refuses a revoked token', async () => {
    apiTokenRepository.findByHash.mockResolvedValue(null);

    const response = await POST(mcpRequest({ authorization: `Bearer ${token}` }), ROUTE_CONTEXT);

    await expectJsonRpcRefusal({
      response,
      status: 401,
      code: 'INVALID_API_TOKEN',
    });
  });

  it('answers a tripped rate limit as a JSON-RPC error', async () => {
    enforceRateLimits.mockRejectedValueOnce(
      new HttpError(429, 'Too many requests. Try again later.'),
    );

    const response = await POST(mcpRequest({ authorization: `Bearer ${token}` }), ROUTE_CONTEXT);

    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Too many requests. Try again later.' },
    });
    expect(enforceRateLimits).toHaveBeenCalledWith([
      expect.objectContaining({ key: `mcp:user:${TOKEN_OWNER}` }),
    ]);
  });
});

describe('POST /api/mcp with an AGENT token', () => {
  it('initializes without a session, as a stateless server', async () => {
    const response = await POST(mcpRequest({ authorization: `Bearer ${token}` }), ROUTE_CONTEXT);

    expect(response.status).toBe(200);
    expect(response.headers.get('mcp-session-id')).toBeNull();
    const body = await response.json();
    expect(body.result.serverInfo.name).toBe('my-expenses');
    expect(body.result.instructions).toContain('ILS');
  });

  it('lists tools on a fresh request with no prior initialize', async () => {
    const response = await POST(
      mcpRequest({
        authorization: `Bearer ${token}`,
        body: { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
      }),
      ROUTE_CONTEXT,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.result.tools.length).toBeGreaterThan(0);
  });
});

describe('protocol errors', () => {
  it('refuses a JSON-RPC batch, which would let one rate-limited request carry many tool calls', async () => {
    const call = (id: number) => ({
      jsonrpc: '2.0',
      id,
      method: 'tools/list',
      params: {},
    });
    const response = await POST(
      mcpRequest({
        authorization: `Bearer ${token}`,
        body: [call(1), call(2)],
      }),
      ROUTE_CONTEXT,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32600 },
    });
  });

  it('logs a JSON-RPC error the SDK answers, with the method it answered', async () => {
    const response = await POST(
      mcpRequest({
        authorization: `Bearer ${token}`,
        body: { jsonrpc: '2.0', id: 3, method: 'resources/list', params: {} },
      }),
      ROUTE_CONTEXT,
    );

    const body = await response.json();
    expect(body.error.code).toBeDefined();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: TOKEN_OWNER,
        method: 'resources/list',
        code: body.error.code,
      }),
      'MCP request answered with a JSON-RPC error',
    );
  });
});

describe('GET and DELETE /api/mcp', () => {
  it('decline with a JSON-RPC 405, since there is no stream or session', async () => {
    for (const response of [await GET(), await DELETE()]) {
      expect(response.status).toBe(405);
      expect(response.headers.get('allow')).toBe('POST');
      expect(await response.json()).toMatchObject({ jsonrpc: '2.0' });
    }
  });
});
