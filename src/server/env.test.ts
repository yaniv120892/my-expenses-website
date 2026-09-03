import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { assertCoreEnv, requireSiteUrl } from '@/server/env';

describe('assertCoreEnv', () => {
  const POOLED = 'ep-dry-flower-a2cf61nu-pooler.eu-central-1.aws.neon.tech';
  const DIRECT = 'ep-dry-flower-a2cf61nu.eu-central-1.aws.neon.tech';

  beforeEach(() => {
    vi.stubEnv('DIRECT_URL', `postgresql://user:pass@${DIRECT}/neondb`);
    vi.stubEnv('JWT_SECRET', 'secret');
    vi.stubEnv('REDIS_URL', 'https://redis.example');
    vi.stubEnv('REDIS_TOKEN', 'token');
    vi.stubEnv('CRON_SECRET', 'cron');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('accepts a pooled URL that disables prepared statements', () => {
    vi.stubEnv(
      'DATABASE_URL',
      `postgresql://user:pass@${POOLED}/neondb?sslmode=require&pgbouncer=true&connection_limit=1`,
    );
    expect(() => assertCoreEnv()).not.toThrow();
  });

  it('rejects a pooled URL that would let Prisma name prepared statements', () => {
    vi.stubEnv(
      'DATABASE_URL',
      `postgresql://user:pass@${POOLED}/neondb?sslmode=require`,
    );
    expect(() => assertCoreEnv()).toThrow(/pgbouncer=true/);
  });

  // The direct endpoint is one session per connection, so naming statements is
  // safe there; requiring the parameter would fail migrations and the seed.
  it('accepts the direct endpoint without the parameter', () => {
    vi.stubEnv(
      'DATABASE_URL',
      `postgresql://user:pass@${DIRECT}/neondb?sslmode=require`,
    );
    expect(() => assertCoreEnv()).not.toThrow();
  });

  it('accepts the prisma dev address CI and dev:local run on', () => {
    vi.stubEnv('DATABASE_URL', 'prisma+postgres://localhost:51213/?api_key=k');
    expect(() => assertCoreEnv()).not.toThrow();
  });

  // Putting the Accelerate URL back is the rollback for the pooled cutover, so
  // this check must not be what stops it.
  it('accepts an Accelerate URL', () => {
    vi.stubEnv(
      'DATABASE_URL',
      'prisma://accelerate.prisma-data.net/?api_key=key',
    );
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

  // The git-derived hosts resolve in production too, so without this gate a
  // production deploy that lost WEBSITE_URL would mail real users a
  // vercel.app link instead of failing where someone would notice.
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
