import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { assertCoreEnv, optionalEnv, requireSiteUrl } from '@/server/env';

describe('assertCoreEnv', () => {
  const DIRECT = 'ep-dry-flower-a2cf61nu.eu-central-1.aws.neon.tech';

  beforeEach(() => {
    vi.stubEnv('DATABASE_URL', `postgresql://user:pass@${DIRECT}/neondb`);
    vi.stubEnv('DIRECT_URL', `postgresql://user:pass@${DIRECT}/neondb`);
    vi.stubEnv('JWT_SECRET', 'secret');
    vi.stubEnv('REDIS_URL', 'https://redis.example');
    vi.stubEnv('REDIS_TOKEN', 'token');
    vi.stubEnv('CRON_SECRET', 'cron');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rejects an unset DATABASE_URL', () => {
    vi.stubEnv('DATABASE_URL', '');
    expect(() => assertCoreEnv()).toThrow(/DATABASE_URL/);
  });

  it('rejects an AI_CATEGORY_SUGGESTER value it does not know', () => {
    vi.stubEnv('AI_CATEGORY_SUGGESTER', 'jevv');
    expect(() => assertCoreEnv()).toThrow(/AI_CATEGORY_SUGGESTER/);
  });

  it('accepts AI_CATEGORY_SUGGESTER unset or empty, and jev with a key in any case', () => {
    vi.stubEnv('AI_GATEWAY_API_KEY', 'gateway-key');
    for (const value of [undefined, '', 'jev', 'JEV']) {
      vi.stubEnv('AI_CATEGORY_SUGGESTER', value);
      expect(() => assertCoreEnv()).not.toThrow();
    }
  });

  it('rejects jev without either key, since the flag would then silently do nothing', () => {
    vi.stubEnv('AI_CATEGORY_SUGGESTER', 'jev');
    vi.stubEnv('AI_GATEWAY_API_KEY', '');
    vi.stubEnv('TYPESAFE_AI_API_KEY', '');
    expect(() => assertCoreEnv()).toThrow(/needs TYPESAFE_AI_API_KEY/);

    vi.stubEnv('TYPESAFE_AI_API_KEY', 'direct-key');
    expect(() => assertCoreEnv()).not.toThrow();
  });
});

describe('requireSiteUrl', () => {
  beforeEach(() => {
    vi.stubEnv('WEBSITE_URL', undefined);
    vi.stubEnv('VERCEL_BRANCH_URL', undefined);
    vi.stubEnv('VERCEL_URL', undefined);
    vi.stubEnv('VERCEL_ENV', undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('prefers an explicit WEBSITE_URL', () => {
    vi.stubEnv('WEBSITE_URL', 'https://expenses.example');
    vi.stubEnv('VERCEL_BRANCH_URL', 'branch.vercel.app');
    expect(requireSiteUrl()).toBe('https://expenses.example');
  });

  it('falls back to the branch URL so a preview addresses itself', () => {
    vi.stubEnv('VERCEL_BRANCH_URL', 'branch.vercel.app');
    vi.stubEnv('VERCEL_URL', 'deployment.vercel.app');
    expect(requireSiteUrl()).toBe('https://branch.vercel.app');
  });

  it('falls back to the deployment URL when there is no branch URL', () => {
    vi.stubEnv('VERCEL_URL', 'deployment.vercel.app');
    expect(requireSiteUrl()).toBe('https://deployment.vercel.app');
  });

  it('throws when nothing names the site', () => {
    expect(() => requireSiteUrl()).toThrow('WEBSITE_URL');
  });

  it('refuses to guess an origin in production', () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('VERCEL_BRANCH_URL', 'branch.vercel.app');
    vi.stubEnv('VERCEL_URL', 'deployment.vercel.app');
    expect(() => requireSiteUrl()).toThrow('WEBSITE_URL');
  });

  it('still prefers an explicit WEBSITE_URL in production', () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('WEBSITE_URL', 'https://expenses.example');
    vi.stubEnv('VERCEL_BRANCH_URL', 'branch.vercel.app');
    expect(requireSiteUrl()).toBe('https://expenses.example');
  });

  it('derives the origin on a preview deployment', () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('VERCEL_BRANCH_URL', 'branch.vercel.app');
    expect(requireSiteUrl()).toBe('https://branch.vercel.app');
  });
});

describe('optionalEnv', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('treats an empty value as unset', () => {
    vi.stubEnv('OPTIONAL_ENV_UNDER_TEST', '');
    expect(optionalEnv('OPTIONAL_ENV_UNDER_TEST', 'fallback')).toBe('fallback');
  });

  it('returns a set value untouched', () => {
    vi.stubEnv('OPTIONAL_ENV_UNDER_TEST', 'value');
    expect(optionalEnv('OPTIONAL_ENV_UNDER_TEST', 'fallback')).toBe('value');
  });
});
