import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatDateRange,
  formatTrendDate,
} from '@/utils/dateUtils';

describe('formatTrendDate', () => {
  it('renders weekly buckets as "Week N" from the key suffix', () => {
    expect(formatTrendDate('2024-23', 'weekly')).toBe('Week 23');
    expect(formatTrendDate('2024-01', 'weekly')).toBe('Week 01');
  });

  it('renders monthly buckets as MMM yyyy', () => {
    expect(formatTrendDate('2024-02', 'monthly')).toBe('Feb 2024');
    expect(formatTrendDate('2023-12', 'monthly')).toBe('Dec 2023');
  });

  it('passes yearly buckets through unchanged', () => {
    expect(formatTrendDate('2024', 'yearly')).toBe('2024');
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

describe('formatDateRange', () => {
  it('formats both bounds with the default separator', () => {
    expect(formatDateRange(new Date(2024, 0, 15), new Date(2024, 1, 29))).toBe(
      'Jan 15, 2024 - Feb 29, 2024',
    );
  });

  it('leaves a missing bound blank', () => {
    expect(formatDateRange(new Date(2024, 0, 15), undefined)).toBe(
      'Jan 15, 2024 - ',
    );
    expect(formatDateRange(undefined, new Date(2024, 0, 15))).toBe(
      ' - Jan 15, 2024',
    );
    expect(formatDateRange()).toBe(' - ');
  });

  it('accepts date strings and a custom separator', () => {
    expect(
      formatDateRange('2024-06-01T00:00:00', '2024-06-30T00:00:00', 'to'),
    ).toBe('Jun 1, 2024 to Jun 30, 2024');
  });
});
