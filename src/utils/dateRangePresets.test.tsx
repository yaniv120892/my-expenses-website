// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAppFormat } from '@/i18n/useAppFormat';
import { useT } from '@/i18n/useT';
import { DesignTestProvider } from '@/test/renderWithClient';
import type { Locale } from '@yaniv120892/my-ui';
import {
  DATE_RANGE_PRESETS,
  defaultDateRange,
  describeDateRange,
  matchDateRangePreset,
  type DateRange,
} from '@/utils/dateRangePresets';

// Mid-month, mid-year, so a preset that leaked "today" as a bound would show.
const NOW = new Date(2026, 6, 14);

function rangeOf(id: string, now: Date = NOW) {
  const preset = DATE_RANGE_PRESETS.find((candidate) => candidate.id === id);
  if (!preset) {
    throw new Error(`no date range preset named ${id}`);
  }
  return preset.range(now);
}

describe('DATE_RANGE_PRESETS', () => {
  it('covers whole calendar months, not a window ending today', () => {
    expect(rangeOf('this-month')).toEqual({
      startDate: '2026-07-01',
      endDate: '2026-07-31',
    });
    expect(rangeOf('last-month')).toEqual({
      startDate: '2026-06-01',
      endDate: '2026-06-30',
    });
  });

  it('counts the current month as one of the last three', () => {
    expect(rangeOf('last-3-months')).toEqual({
      startDate: '2026-05-01',
      endDate: '2026-07-31',
    });
  });

  it('covers the whole year and leaves all-time unbounded', () => {
    expect(rangeOf('this-year')).toEqual({
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    });
    expect(rangeOf('all-time')).toEqual({});
  });

  it('crosses the year boundary in December', () => {
    expect(rangeOf('last-3-months', new Date(2026, 11, 3))).toEqual({
      startDate: '2026-10-01',
      endDate: '2026-12-31',
    });
  });

  it('crosses the year boundary in January', () => {
    expect(rangeOf('last-month', new Date(2026, 0, 9))).toEqual({
      startDate: '2025-12-01',
      endDate: '2025-12-31',
    });
  });
});

describe('matchDateRangePreset', () => {
  it('names the preset a range came from, so the chip can show as selected', () => {
    expect(matchDateRangePreset(rangeOf('this-month'), NOW)).toBe('this-month');
    expect(matchDateRangePreset(rangeOf('this-year'), NOW)).toBe('this-year');
  });

  it('treats an unbounded range as all-time', () => {
    expect(matchDateRangePreset({}, NOW)).toBe('all-time');
    expect(matchDateRangePreset({ startDate: undefined, endDate: undefined }, NOW)).toBe(
      'all-time',
    );
  });

  it('returns undefined for a hand-typed range matching no preset', () => {
    expect(
      matchDateRangePreset({ startDate: '2026-07-03', endDate: '2026-07-19' }, NOW),
    ).toBeUndefined();
  });

  it('does not match a half-bounded range against a full preset', () => {
    expect(matchDateRangePreset({ startDate: '2026-07-01' }, NOW)).toBeUndefined();
  });
});

describe('defaultDateRange', () => {
  it('is this month, so the page and the chips agree on where it opened', () => {
    expect(defaultDateRange(NOW)).toEqual(rangeOf('this-month'));
    expect(matchDateRangePreset(defaultDateRange(NOW), NOW)).toBe('this-month');
  });
});

function describeIn(locale: Locale) {
  const { result } = renderHook(() => ({ t: useT(), formatter: useAppFormat() }), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <DesignTestProvider locale={locale}>{children}</DesignTestProvider>
    ),
  });
  return (range: DateRange) => describeDateRange({ range, ...result.current });
}

describe('describeDateRange', () => {
  const describeRange = describeIn('en');

  it('names a whole calendar month', () => {
    expect(describeRange(rangeOf('this-month'))).toBe('July 2026');
  });

  it('names a whole calendar year', () => {
    expect(describeRange(rangeOf('this-year'))).toBe('2026');
  });

  it('spells out a span that is neither', () => {
    expect(describeRange(rangeOf('last-3-months'))).toBe('May 1, 2026 – Jul 31, 2026');
  });

  it('handles an unbounded and a half-bounded range', () => {
    expect(describeRange({})).toBe('All time');
    expect(describeRange({ startDate: '2026-07-01' })).toBe('From Jul 1, 2026');
    expect(describeRange({ endDate: '2026-07-31' })).toBe('Until Jul 31, 2026');
  });

  it('speaks Hebrew in a Hebrew session', () => {
    const describeInHebrew = describeIn('he');
    expect(describeInHebrew({})).toBe('כל הזמן');
    expect(describeInHebrew(rangeOf('this-month'))).toBe('יולי 2026');
  });
});
