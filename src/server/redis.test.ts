import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { redisKeyPrefix } from '@/server/redis';

describe('redisKeyPrefix', () => {
  const saved = { ...process.env };

  beforeEach(() => {
    delete process.env.VERCEL_ENV;
    delete process.env.VERCEL_GIT_COMMIT_SHA;
    delete process.env.VERCEL_DEPLOYMENT_ID;
  });

  afterEach(() => {
    process.env = { ...saved };
  });

  it('leaves production keys bare so existing sessions keep resolving', () => {
    process.env.VERCEL_ENV = 'production';
    process.env.VERCEL_GIT_COMMIT_SHA = 'abcdef1234567890';
    expect(redisKeyPrefix()).toBe('');
  });

  it('leaves local and CI keys bare, where VERCEL_ENV is unset', () => {
    expect(redisKeyPrefix()).toBe('');
  });

  it('namespaces a preview by the commit it deploys', () => {
    process.env.VERCEL_ENV = 'preview';
    process.env.VERCEL_GIT_COMMIT_SHA = 'abcdef1234567890fedcba';
    expect(redisKeyPrefix()).toBe('preview:abcdef123456:');
  });

  it('gives the next commit a namespace that cannot read the previous one', () => {
    process.env.VERCEL_ENV = 'preview';
    process.env.VERCEL_GIT_COMMIT_SHA = 'aaaaaaaaaaaaaaaa';
    const poisoned = redisKeyPrefix();
    process.env.VERCEL_GIT_COMMIT_SHA = 'bbbbbbbbbbbbbbbb';
    expect(redisKeyPrefix()).not.toBe(poisoned);
  });

  it('falls back to the deployment id when no commit sha is exposed', () => {
    process.env.VERCEL_ENV = 'preview';
    process.env.VERCEL_DEPLOYMENT_ID = 'dpl_123';
    expect(redisKeyPrefix()).toBe('preview:dpl_123:');
  });

  it('falls back to the environment name when nothing identifies the build', () => {
    process.env.VERCEL_ENV = 'preview';
    expect(redisKeyPrefix()).toBe('preview:preview:');
  });
});
