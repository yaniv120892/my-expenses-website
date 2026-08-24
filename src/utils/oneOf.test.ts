import { describe, expect, it } from 'vitest';
import { isOneOf } from '@/utils/oneOf';

const PERIODS = ['daily', 'weekly', 'monthly'] as const;

describe('isOneOf', () => {
  it('accepts a value the allowlist contains', () => {
    expect(isOneOf(PERIODS, 'weekly')).toBe(true);
  });

  it('rejects a value outside the allowlist', () => {
    expect(isOneOf(PERIODS, 'hourly')).toBe(false);
  });

  it('rejects the empty string a cleared control emits', () => {
    expect(isOneOf(PERIODS, '')).toBe(false);
  });

  // The narrowing is the point of the helper: a cast would have let any string
  // through, which is what the call sites used to do.
  it('narrows the value to the union for the caller', () => {
    const value: string = 'monthly';
    if (isOneOf(PERIODS, value)) {
      const narrowed: (typeof PERIODS)[number] = value;
      expect(narrowed).toBe('monthly');
      return;
    }
    throw new Error('expected the value to narrow');
  });
});
