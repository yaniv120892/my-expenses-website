import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { queryRaw, getValue, error, after, flushRemoteLogs } = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  getValue: vi.fn(),
  error: vi.fn(),
  after: vi.fn(),
  flushRemoteLogs: vi.fn(),
}));

vi.mock('@/server/db/client', () => ({ default: { $queryRaw: queryRaw } }));
vi.mock('@/server/redis', () => ({ getValue }));
vi.mock('@/server/logging/logger', () => ({ default: { error } }));
vi.mock('@/server/logging/betterStackStream', () => ({ flushRemoteLogs }));
// `after` throws outside a request scope, which is where these tests call the
// handler.
vi.mock('next/server', async () => ({
  ...(await vi.importActual<typeof import('next/server')>('next/server')),
  after,
}));

// The route caches its outcome in module scope, so each test loads a fresh copy.
let GET: typeof import('@/app/api/health/deep/route').GET;

beforeEach(async () => {
  vi.resetModules();
  ({ GET } = await import('@/app/api/health/deep/route'));
  vi.clearAllMocks();
  queryRaw.mockResolvedValue([{ '?column?': 1 }]);
  getValue.mockResolvedValue(null);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('deep check', () => {
  it('probes both dependencies and reports each', async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: 'ok',
      checks: { db: 'ok', redis: 'ok' },
      checkedAt: expect.any(String),
    });
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(getValue).toHaveBeenCalledWith('health:probe');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('names the failing dependency when the database is down', async () => {
    queryRaw.mockRejectedValue(new Error('connection refused'));

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      status: 'unhealthy',
      checks: { db: 'fail', redis: 'ok' },
      checkedAt: expect.any(String),
    });
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ check: 'db' }),
      'Health check failed',
    );
  });

  it('names the failing dependency when redis is down', async () => {
    getValue.mockRejectedValue(new Error('upstash unreachable'));

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      status: 'unhealthy',
      checks: { db: 'ok', redis: 'fail' },
      checkedAt: expect.any(String),
    });
  });

  it('reports both as failed rather than only the first rejection', async () => {
    queryRaw.mockRejectedValue(new Error('connection refused'));
    getValue.mockRejectedValue(new Error('upstash unreachable'));

    const response = await GET();

    await expect(response.json()).resolves.toEqual({
      status: 'unhealthy',
      checks: { db: 'fail', redis: 'fail' },
      checkedAt: expect.any(String),
    });
    expect(error).toHaveBeenCalledTimes(2);
  });

  it('schedules a remote log flush', async () => {
    await GET();

    expect(after).toHaveBeenCalledTimes(1);
    after.mock.calls[0][0]();
    expect(flushRemoteLogs).toHaveBeenCalledTimes(1);
  });

  it('fails a dependency that hangs instead of hanging the request', async () => {
    vi.useFakeTimers();
    getValue.mockReturnValue(new Promise(() => {}));

    const pending = GET();
    await vi.advanceTimersByTimeAsync(5000);
    const response = await pending;

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      status: 'unhealthy',
      checks: { db: 'ok', redis: 'fail' },
      checkedAt: expect.any(String),
    });
  });
});

describe('result cache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('answers repeat calls within 60s without touching either dependency', async () => {
    const first = await GET();
    vi.advanceTimersByTime(59_999);
    const second = await GET();

    expect(second.status).toBe(200);
    await expect(second.json()).resolves.toEqual(await first.json());
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(getValue).toHaveBeenCalledTimes(1);
  });

  it('probes again once the cached result is 60s old', async () => {
    await GET();
    vi.advanceTimersByTime(60_000);
    await GET();

    expect(queryRaw).toHaveBeenCalledTimes(2);
    expect(getValue).toHaveBeenCalledTimes(2);
  });

  it('caches a failure with its 503 until the window ends', async () => {
    queryRaw.mockRejectedValueOnce(new Error('connection refused'));
    await GET();

    vi.advanceTimersByTime(30_000);
    const cachedFailure = await GET();
    expect(cachedFailure.status).toBe(503);
    expect(queryRaw).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(30_000);
    const recovered = await GET();
    expect(recovered.status).toBe(200);
    expect(queryRaw).toHaveBeenCalledTimes(2);
  });

  it('runs one check for concurrent calls that miss the cache', async () => {
    const responses = await Promise.all([GET(), GET(), GET()]);

    expect(responses.map((response) => response.status)).toEqual([200, 200, 200]);
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(getValue).toHaveBeenCalledTimes(1);
  });
});
