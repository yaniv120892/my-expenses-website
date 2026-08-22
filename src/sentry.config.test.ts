import * as Sentry from '@sentry/nextjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initSentry } from '../sentry.config';

// The module under test lives at the repo root; the test sits here because
// vitest only collects `src/**/*.test.ts`.
vi.mock('@sentry/nextjs', () => ({ init: vi.fn() }));

const DSN = 'https://examplePublicKey@o0.ingest.sentry.io/0';

describe('initSentry', () => {
  const original = { ...process.env };

  beforeEach(() => {
    vi.mocked(Sentry.init).mockClear();
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    delete process.env.NEXT_PUBLIC_VERCEL_ENV;
    delete process.env.VERCEL_ENV;
  });

  afterEach(() => {
    process.env = { ...original };
  });

  it('leaves the SDK uninstalled when no DSN is configured', () => {
    initSentry();

    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it('reports the deploy environment the browser can see', () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = DSN;
    process.env.NEXT_PUBLIC_VERCEL_ENV = 'preview';
    process.env.VERCEL_ENV = 'production';

    initSentry();

    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({ dsn: DSN, environment: 'preview' }),
    );
  });

  it('falls back to the server-only deploy environment off the browser', () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = DSN;
    process.env.VERCEL_ENV = 'production';

    initSentry();

    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({ environment: 'production' }),
    );
  });

  it('keeps performance tracing off so it cannot bill a second quota', () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = DSN;

    initSentry();

    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({ tracesSampleRate: 0 }),
    );
  });
});
