import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const commands = {
  set: vi.fn(),
  get: vi.fn(),
  del: vi.fn(),
  incr: vi.fn(),
};

vi.mock('@upstash/redis', () => ({
  Redis: class {
    constructor() {
      return commands;
    }
  },
}));

const SHA = 'abcdef1234567890';
const BRANCH = 'feature/imports';

describe('redisKeyPrefix', () => {
  beforeEach(() => {
    vi.stubEnv('VERCEL_ENV', undefined);
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', undefined);
    vi.stubEnv('VERCEL_GIT_COMMIT_REF', undefined);
    vi.stubEnv('VERCEL_DEPLOYMENT_ID', undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('leaves production bare so existing sessions keep resolving', async () => {
    const { redisKeyPrefix } = await import('@/server/redis');
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', SHA);
    expect(redisKeyPrefix()).toBe('');
    expect(redisKeyPrefix('branch')).toBe('');
  });

  // An unconfigured local process pointed at a real REDIS_URL must not be able
  // to write into production's keyspace, so absence of VERCEL_ENV namespaces
  // rather than falling through to bare keys.
  it('namespaces local and CI, where VERCEL_ENV is unset', async () => {
    const { redisKeyPrefix } = await import('@/server/redis');
    expect(redisKeyPrefix()).toBe('local:');
    expect(redisKeyPrefix('branch')).toBe('local:');
  });

  it('namespaces a preview cache by the commit it deploys', async () => {
    const { redisKeyPrefix } = await import('@/server/redis');
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', SHA);
    expect(redisKeyPrefix()).toBe('preview:abcdef123456:');
  });

  it('namespaces branch-scoped keys by the branch, so a push keeps them', async () => {
    const { redisKeyPrefix } = await import('@/server/redis');
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', SHA);
    vi.stubEnv('VERCEL_GIT_COMMIT_REF', BRANCH);
    expect(redisKeyPrefix('branch')).toBe(`preview:${BRANCH}:`);
  });

  it('gives the next commit a cache namespace the previous one cannot poison', async () => {
    const { redisKeyPrefix } = await import('@/server/redis');
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'aaaaaaaaaaaa1111');
    expect(redisKeyPrefix()).toBe('preview:aaaaaaaaaaaa:');
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'bbbbbbbbbbbb2222');
    expect(redisKeyPrefix()).toBe('preview:bbbbbbbbbbbb:');
  });

  it('falls back to the deployment id when no commit sha is exposed', async () => {
    const { redisKeyPrefix } = await import('@/server/redis');
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('VERCEL_DEPLOYMENT_ID', 'dpl_123');
    expect(redisKeyPrefix()).toBe('preview:dpl_123:');
  });
});

// The namespace is only worth anything if every wrapper actually applies it:
// dropping the call inside one of them would reintroduce cross-environment
// reads while every prefix test above still passed.
describe('the wrappers namespace what they send to Redis', () => {
  beforeEach(() => {
    vi.stubEnv('REDIS_URL', 'http://127.0.0.1:1');
    vi.stubEnv('REDIS_TOKEN', 'test');
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', SHA);
    vi.stubEnv('VERCEL_GIT_COMMIT_REF', BRANCH);
    commands.set.mockReset().mockResolvedValue('OK');
    commands.get.mockReset().mockResolvedValue(null);
    commands.del.mockReset().mockResolvedValue(1);
    commands.incr.mockReset().mockResolvedValue(2);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('prefixes set, get and del with the build namespace', async () => {
    const { setValue, getValue, deleteValue } = await import('@/server/redis');
    await setValue('categories:all', 'value', 60);
    await getValue('categories:all');
    await deleteValue('categories:all');

    const expected = 'preview:abcdef123456:categories:all';
    expect(commands.set).toHaveBeenCalledWith(expected, 'value', { ex: 60 });
    expect(commands.get).toHaveBeenCalledWith(expected);
    expect(commands.del).toHaveBeenCalledWith(expected);
  });

  it('prefixes a counter', async () => {
    const { incrementWithTtl } = await import('@/server/redis');
    await incrementWithTtl('rate:ip:1.2.3.4', 60);
    expect(commands.incr).toHaveBeenCalledWith(
      'preview:abcdef123456:rate:ip:1.2.3.4',
    );
  });

  it('sends branch-scoped keys under the branch namespace', async () => {
    const { setValue, getValue } = await import('@/server/redis');
    await setValue('session:u1:tok', '1', 60, 'branch');
    await getValue('session:u1:tok', 'branch');

    const expected = `preview:${BRANCH}:session:u1:tok`;
    expect(commands.set).toHaveBeenCalledWith(expected, '1', { ex: 60 });
    expect(commands.get).toHaveBeenCalledWith(expected);
  });

  it('never sends a bare key from a preview', async () => {
    const { setValue } = await import('@/server/redis');
    await setValue('categories:all', 'value', 60);
    expect(commands.set).not.toHaveBeenCalledWith(
      'categories:all',
      expect.anything(),
      expect.anything(),
    );
  });
});
