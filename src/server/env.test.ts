import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { requireSiteUrl } from '@/server/env';

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
