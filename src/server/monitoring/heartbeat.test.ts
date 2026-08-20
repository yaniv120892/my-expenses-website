import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { warn } = vi.hoisted(() => ({ warn: vi.fn() }));

vi.mock('@/server/logging/logger', () => ({
  default: { warn, info: vi.fn(), error: vi.fn() },
}));

import { pingHeartbeat } from '@/server/monitoring/heartbeat';

const URL = 'https://uptime.betterstack.com/api/v1/heartbeat/abc123';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
  process.env.BETTERSTACK_HEARTBEAT_SUMMARY_TODAY = URL;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.BETTERSTACK_HEARTBEAT_SUMMARY_TODAY;
});

describe('pingHeartbeat', () => {
  it('posts to the URL named by the heartbeat', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

    await pingHeartbeat('summary-today');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(URL);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST' });
    expect(warn).not.toHaveBeenCalled();
  });

  it('derives the env var name by upper-casing and replacing dashes', async () => {
    process.env.BETTERSTACK_HEARTBEAT_SUBSCRIPTIONS_AUDIT_NOTIFY = URL;
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

    await pingHeartbeat('subscriptions-audit-notify');

    expect(fetchMock.mock.calls[0][0]).toBe(URL);
    delete process.env.BETTERSTACK_HEARTBEAT_SUBSCRIPTIONS_AUDIT_NOTIFY;
  });

  it('does nothing when the env var is unset', async () => {
    delete process.env.BETTERSTACK_HEARTBEAT_SUMMARY_TODAY;

    await pingHeartbeat('summary-today');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it('swallows a non-2xx response and warns', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 503 }));

    await expect(pingHeartbeat('summary-today')).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith(
      { name: 'summary-today', status: 503 },
      expect.any(String),
    );
  });

  it('swallows a rejected fetch and warns with the error', async () => {
    const err = new Error('network down');
    fetchMock.mockRejectedValue(err);

    await expect(pingHeartbeat('summary-today')).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith(
      { err, name: 'summary-today' },
      expect.any(String),
    );
  });
});
