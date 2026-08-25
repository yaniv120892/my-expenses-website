import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { warn, info } = vi.hoisted(() => ({ warn: vi.fn(), info: vi.fn() }));

vi.mock('@/server/logging/logger', () => ({ default: { warn, info } }));

import { pingHeartbeat } from '@/server/monitoring/heartbeat';

const ENV_VAR = 'BETTERSTACK_HEARTBEAT_SUMMARY_TODAY';
const HEARTBEAT_URL = 'https://uptime.betterstack.com/api/v1/heartbeat/abc123';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
  process.env[ENV_VAR] = HEARTBEAT_URL;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env[ENV_VAR];
});

describe('pingHeartbeat', () => {
  it('posts to the URL held by the env var', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

    await pingHeartbeat(ENV_VAR);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(HEARTBEAT_URL);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST' });
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns when the env var is unset so the no-op is not silent', async () => {
    delete process.env[ENV_VAR];

    await pingHeartbeat(ENV_VAR);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith({ envVar: ENV_VAR }, expect.any(String));
  });

  it('swallows a non-2xx response and warns', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 503 }));

    await expect(pingHeartbeat(ENV_VAR)).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith(
      { envVar: ENV_VAR, status: 503 },
      expect.any(String),
    );
  });

  it('swallows a rejected fetch and warns with the error', async () => {
    const err = new Error('network down');
    fetchMock.mockRejectedValue(err);

    await expect(pingHeartbeat(ENV_VAR)).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith(
      { err, envVar: ENV_VAR },
      expect.any(String),
    );
  });
});
