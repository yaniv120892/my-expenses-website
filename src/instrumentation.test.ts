import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { onRequestErrorInPackage } = vi.hoisted(() => ({
  onRequestErrorInPackage: vi.fn(),
}));

vi.mock('@/server/observability', () => ({
  observability: { onRequestError: onRequestErrorInPackage },
}));

import { onRequestError } from '@/instrumentation';

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
