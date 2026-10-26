import { describe, expect, it } from 'vitest';
import { formatDate, parseDayInput } from '@/utils/dateUtils';

describe('parseDayInput', () => {
  it('reads a day as local midnight, not UTC', () => {
    expect(parseDayInput('2024-03-15')).toEqual(new Date(2024, 2, 15));
  });

  it('returns null for a cleared or unparseable input', () => {
    expect(parseDayInput('')).toBeNull();
    expect(parseDayInput('2024-13-45')).toBeNull();
  });
});

describe('formatDate', () => {
  it('uses the locale date format when time is omitted', () => {
    expect(formatDate('2024-03-15T12:00:00')).toBe(
      new Date('2024-03-15T12:00:00').toLocaleDateString(),
    );
  });

  it('renders dd/MM/yyyy HH:mm when includeTime is true', () => {
    expect(formatDate('2024-03-15T09:05:00', true)).toBe('15/03/2024 09:05');
  });

  it('keeps the local year across the year boundary', () => {
    expect(formatDate('2023-12-31T23:59:00', true)).toBe('31/12/2023 23:59');
    expect(formatDate('2024-01-01T00:00:00', true)).toBe('01/01/2024 00:00');
  });
});
