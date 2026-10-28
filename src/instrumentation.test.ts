import * as Sentry from '@sentry/nextjs';
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
  const S3_ORIGIN = 'https://receipts.s3.eu-west-1.amazonaws.com';

  afterEach(async () => {
    await Sentry.close();
    vi.unstubAllEnvs();
  });

  it('sends Sentry an outgoing request breadcrumb with only its origin', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://public@o0.ingest.sentry.io/0');
    await register();
    const sentEvents = captureSentEvents();

    Sentry.addBreadcrumb({
      type: 'http',
      category: 'http',
      data: {
        url: `${S3_ORIGIN}/transactions/1111/abc-bank-statement-march.pdf`,
        'http.method': 'DELETE',
        'url.query': 'X-Amz-Signature=abc123',
        status_code: 204,
      },
    });
    Sentry.captureException(new Error('attachment delete failed'));
    await Sentry.flush();

    expect(sentEvents).toEqual([
      expect.objectContaining({
        breadcrumbs: [
          expect.objectContaining({
            category: 'http',
            data: { url: S3_ORIGIN, 'http.method': 'DELETE', status_code: 204 },
          }),
        ],
      }),
    ]);
  });
});

function captureSentEvents(): Sentry.Event[] {
  const client = Sentry.getClient();
  const transport = client?.getTransport();
  if (!client || !transport) {
    throw new Error('register() did not initialise Sentry');
  }
  vi.spyOn(transport, 'send').mockResolvedValue({ statusCode: 200 });
  const sentEvents: Sentry.Event[] = [];
  client.on('beforeSendEvent', (event) => {
    sentEvents.push(event);
  });
  return sentEvents;
}
