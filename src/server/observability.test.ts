import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ObservabilityModule from '@/server/observability';

const { incrementWithTtl, captureException } = vi.hoisted(() => ({
  incrementWithTtl: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock('@/server/redis', () => ({ incrementWithTtl }));
vi.mock('@sentry/nextjs', () => ({ captureException, captureRequestError: vi.fn() }));

let observability: typeof ObservabilityModule.observability;

beforeEach(async () => {
  vi.resetModules();
  globalThis.observabilityByService = undefined;
  vi.stubEnv('TELEGRAM_BOT_TOKEN', 'bot-token');
  vi.stubEnv('TELEGRAM_ALERT_CHAT_ID', 'ops-chat');
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('{}')),
  );
  incrementWithTtl.mockReset();
  captureException.mockReset();
  ({ observability } = await import('@/server/observability'));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  globalThis.observabilityByService = undefined;
});

describe('ops alert cap', () => {
  it('counts each alert type in Redis, so the hourly cap holds across instances', async () => {
    incrementWithTtl.mockResolvedValue(1);

    await observability.notifyOpsAlert({ alertType: '5xx GET /api/transactions', title: 'boom' });

    expect(incrementWithTtl).toHaveBeenCalledWith('ops-alert:5xx-get-api-transactions', 3600);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('sends nothing once Redis says the cap and its notice are spent', async () => {
    incrementWithTtl.mockResolvedValue(7);

    await observability.notifyOpsAlert({ alertType: '5xx GET /api/transactions', title: 'boom' });

    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('reportError', () => {
  it('hands Sentry the context as extra and tags before it returns', () => {
    const error = new Error('tool blew up');

    observability.reportError({
      error,
      where: 'MCP tool failed',
      context: { userId: 'user-1', toolName: 'add_transaction', token: 'mxk_secret' },
    });

    expect(captureException).toHaveBeenCalledWith(error, {
      tags: { toolName: 'add_transaction', where: 'MCP tool failed' },
      extra: { userId: 'user-1', toolName: 'add_transaction', token: '[redacted]' },
    });
  });

  it('keeps importId and requestId as tags, so a failed import stays searchable in Sentry', () => {
    const error = new Error('extraction failed');

    observability.reportError({
      error,
      where: 'Error processing webhook',
      context: { importId: 'import-1', requestId: 'request-1' },
    });

    expect(captureException).toHaveBeenCalledWith(error, {
      tags: {
        importId: 'import-1',
        requestId: 'request-1',
        where: 'Error processing webhook',
      },
      extra: { importId: 'import-1', requestId: 'request-1' },
    });
  });
});
