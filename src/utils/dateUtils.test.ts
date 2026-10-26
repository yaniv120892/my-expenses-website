import { describe, expect, it } from 'vitest';
import { parseDayInput } from '@/utils/dateUtils';

describe('parseDayInput', () => {
  it('reads a day as local midnight, not UTC', () => {
    expect(parseDayInput('2024-03-15')).toEqual(new Date(2024, 2, 15));
  });

  it('returns null for a cleared or unparseable input', () => {
    expect(parseDayInput('')).toBeNull();
    expect(parseDayInput('2024-13-45')).toBeNull();
  });
});
