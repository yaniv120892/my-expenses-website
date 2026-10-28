import * as Sentry from '@sentry/nextjs';
import { createServer, type Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { onRequestErrorInPackage } = vi.hoisted(() => ({
  onRequestErrorInPackage: vi.fn(),
}));

vi.mock('@/server/observability', () => ({
  observability: { onRequestError: onRequestErrorInPackage },
}));

import { onRequestError, register } from '@/instrumentation';

const request = {
  path: '/dashboard',
  method: 'GET',
  headers: { 'user-agent': 'vitest' },
};

const context = {
  routerKind: 'App Router' as const,
  routePath: '/dashboard',
  routeType: 'render' as const,
  revalidateReason: undefined,
};

describe('onRequestError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('hands a Node.js request error to the observability package', async () => {
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    const err = new Error('boom');

    await onRequestError(err, request, context);

    expect(onRequestErrorInPackage).toHaveBeenCalledWith(err, request, context);
  });

  it('leaves an Edge request error alone, keeping pino out of the Edge bundle', async () => {
    vi.stubEnv('NEXT_RUNTIME', 'edge');

    await onRequestError(new Error('boom'), request, context);

    expect(onRequestErrorInPackage).not.toHaveBeenCalled();
  });
});

describe('register', () => {
  let storage: Server;

  beforeEach(async () => {
    storage = createServer((_request, response) => {
      response.statusCode = 204;
      response.end();
    });
    await new Promise<void>((resolve) => storage.listen(0, '127.0.0.1', resolve));
  });

  afterEach(async () => {
    Sentry.getIsolationScope().clearBreadcrumbs();
    await Sentry.close();
    storage.close();
    vi.unstubAllEnvs();
  });

  it('keeps only the origin of an outgoing request in its Sentry breadcrumb', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://public@o0.ingest.sentry.io/0');
    await register();
    const origin = originOf(storage);

    await fetch(`${origin}/transactions/1111/abc-bank-statement-march.pdf?X-Amz-Signature=abc123`, {
      method: 'DELETE',
    });

    expect(Sentry.getIsolationScope().getScopeData().breadcrumbs).toContainEqual(
      expect.objectContaining({
        category: 'http',
        data: { url: origin, 'http.request.method': 'DELETE', status_code: 204 },
      }),
    );
  });
});

function originOf(server: Server): string {
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error(`Expected a TCP address, got ${address}`);
  }
  return `http://127.0.0.1:${address.port}`;
}
