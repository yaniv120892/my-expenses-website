import { describe, expect, it } from 'vitest';
import { isOutOfCredits } from '@/server/services/ai/outOfCredits';

class ProviderError extends Error {
  public constructor(fields: { status?: number; statusCode?: number; code?: string | null }) {
    super('provider failed');
    Object.assign(this, fields);
  }
}

describe('isOutOfCredits', () => {
  it.each([
    ['a 402 status (Google, OpenAI)', new ProviderError({ status: 402 })],
    ['a 402 statusCode (AI SDK gateway)', new ProviderError({ statusCode: 402 })],
    [
      'an OpenAI insufficient_quota 429',
      new ProviderError({ status: 429, code: 'insufficient_quota' }),
    ],
  ])('is true for %s', (_label, error) => {
    expect(isOutOfCredits(error)).toBe(true);
  });

  it.each([
    ['a plain rate limit', new ProviderError({ status: 429, code: 'rate_limit_exceeded' })],
    ['a server error', new ProviderError({ status: 500 })],
    ['an error without a status', new Error('Timed out')],
    ['a non-object', 'boom'],
    ['null', null],
  ])('is false for %s', (_label, error) => {
    expect(isOutOfCredits(error)).toBe(false);
  });
});
