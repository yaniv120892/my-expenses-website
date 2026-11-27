import { describe, expect, it } from 'vitest';
import { isOutOfCredits, isOutOfCreditsMessage } from '@/server/services/ai/outOfCredits';

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

describe('isOutOfCreditsMessage', () => {
  it.each([
    [
      'an empty status text',
      'AI processing failed: [GoogleGenerativeAI Error]: Error fetching from https://x/models/gemini-2.5-flash:generateContent: [402 ] Your prepayment credits are depleted.',
    ],
    ['a status text', 'Error fetching from https://x: [402 Payment Required] Top up'],
    ['no status text', 'Error fetching from https://x: [402] Top up'],
  ])('is true for a 402 marker with %s', (_label, message) => {
    expect(isOutOfCreditsMessage(message)).toBe(true);
  });

  it.each([
    ['a server error', 'Error fetching from https://x: [500 Internal Server Error] Internal error'],
    ['a status that starts with 402', 'Error fetching from https://x: [4029 ] Unknown'],
    ['402 outside the marker', 'Statement has 402 rows, too many to read'],
    ['an empty message', ''],
  ])('is false for %s', (_label, message) => {
    expect(isOutOfCreditsMessage(message)).toBe(false);
  });
});
