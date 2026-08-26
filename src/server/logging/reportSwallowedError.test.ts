import { describe, it, expect, vi, beforeEach } from 'vitest';

const { loggerError, captureException } = vi.hoisted(() => ({
  loggerError: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock('@/server/logging/logger', () => ({
  default: { error: loggerError },
}));
vi.mock('@sentry/nextjs', () => ({ captureException }));

import { reportSwallowedError } from '@/server/logging/reportSwallowedError';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('reportSwallowedError', () => {
  it('logs the record and reports the same error to Sentry', () => {
    const err = new Error('provider down');

    reportSwallowedError({ err, model: 'some-model' }, 'Gemini API error');

    expect(loggerError).toHaveBeenCalledWith(
      { err, model: 'some-model' },
      'Gemini API error',
    );
    expect(captureException).toHaveBeenCalledWith(err, {
      tags: { swallowedAt: 'Gemini API error' },
    });
  });

  it('reports even when the caller passes no extra fields', () => {
    const err = new Error('bare');

    reportSwallowedError({ err }, 'Something failed');

    expect(captureException).toHaveBeenCalledWith(err, {
      tags: { swallowedAt: 'Something failed' },
    });
  });
});
