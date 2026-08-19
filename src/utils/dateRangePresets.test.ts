import { describe, expect, it } from 'vitest';
import {
  DATE_RANGE_PRESETS,
  defaultDateRange,
  describeDateRange,
  matchDateRangePreset,
} from '@/utils/dateRangePresets';

// Mid-month, mid-year, so a preset that leaked "today" as a bound would show.
const NOW = new Date(2026, 6, 14);

const rangeOf = (id: string) =>
  DATE_RANGE_PRESETS.find((preset) => preset.id === id)!.range(NOW);

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
    const december = new Date(2026, 11, 3);
    const preset = DATE_RANGE_PRESETS.find((p) => p.id === 'last-3-months')!;
    expect(preset.range(december)).toEqual({
      startDate: '2026-10-01',
      endDate: '2026-12-31',
    });
  });

  it('crosses the year boundary in January', () => {
    const january = new Date(2026, 0, 9);
    const lastMonth = DATE_RANGE_PRESETS.find((p) => p.id === 'last-month')!;
    expect(lastMonth.range(january)).toEqual({
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
    expect(
      matchDateRangePreset({ startDate: undefined, endDate: undefined }, NOW),
    ).toBe('all-time');
  });

  it('returns undefined for a hand-typed range matching no preset', () => {
    expect(
      matchDateRangePreset(
        { startDate: '2026-07-03', endDate: '2026-07-19' },
        NOW,
      ),
    ).toBeUndefined();
  });

  it('does not match a half-bounded range against a full preset', () => {
    expect(
      matchDateRangePreset({ startDate: '2026-07-01' }, NOW),
    ).toBeUndefined();
  });
});

describe('defaultDateRange', () => {
  it('is this month, so the page and the chips agree on where it opened', () => {
    expect(defaultDateRange(NOW)).toEqual(rangeOf('this-month'));
    expect(matchDateRangePreset(defaultDateRange(NOW), NOW)).toBe('this-month');
  });
});

describe('describeDateRange', () => {
  it('names a whole calendar month', () => {
    expect(describeDateRange(rangeOf('this-month'))).toBe('July 2026');
  });

  it('names a whole calendar year', () => {
    expect(describeDateRange(rangeOf('this-year'))).toBe('2026');
  });

  it('spells out a span that is neither', () => {
    expect(describeDateRange(rangeOf('last-3-months'))).toBe(
      'May 1, 2026 – Jul 31, 2026',
    );
  });

  it('handles an unbounded and a half-bounded range', () => {
    expect(describeDateRange({})).toBe('All time');
    expect(describeDateRange({ startDate: '2026-07-01' })).toBe(
      'From Jul 1, 2026',
    );
    expect(describeDateRange({ endDate: '2026-07-31' })).toBe(
      'Until Jul 31, 2026',
    );
  });

  it('reads a date-only string as local, not UTC midnight', () => {
    // `new Date('2026-07-01')` is UTC midnight, which is Jun 30 west of
    // Greenwich — the whole-month check would then miss and the label would
    // read as a span.
    expect(
      describeDateRange({ startDate: '2026-07-01', endDate: '2026-07-31' }),
    ).toBe('July 2026');
  });
});
