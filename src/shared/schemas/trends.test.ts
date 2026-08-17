import { describe, it, expect } from 'vitest';
import {
  MAX_COMPARISON_SERIES,
  getCategoryComparisonQuerySchema,
} from '@/shared/schemas/trends';
import { MAX_COMPARISON_SERIES as TYPES_MAX } from '@/shared/types/trends';
import theme from '@/theme';

const CATEGORY_IDS = Array.from(
  { length: 16 },
  (_, i) => `1111111${i.toString(16)}-1111-4111-8111-111111111111`,
);

function query(count: number) {
  return {
    startDate: '2026-08-01',
    endDate: '2026-08-31',
    categoryIds: CATEGORY_IDS.slice(0, count).join(','),
  };
}

describe('comparison series bound', () => {
  // The picker and the route used to hold separate copies of this number.
  it('is a single constant, re-exported rather than repeated', () => {
    expect(MAX_COMPARISON_SERIES).toBe(TYPES_MAX);
  });

  // The bound exists because each series needs its own chart color.
  it('matches the number of chart series colors in the theme', () => {
    expect(theme.palette.charts.series).toHaveLength(MAX_COMPARISON_SERIES);
  });

  it('accepts a selection up to the bound', () => {
    const result = getCategoryComparisonQuerySchema.safeParse(
      query(MAX_COMPARISON_SERIES),
    );
    expect(result.success).toBe(true);
  });

  it('rejects a selection past the bound', () => {
    const result = getCategoryComparisonQuerySchema.safeParse(
      query(MAX_COMPARISON_SERIES + 1),
    );
    expect(result.success).toBe(false);
  });
});

// The series cap bounds the width of the result; nothing bounded its length,
// so a start date from the date input's open lower end enumerated a bucket per
// day back to whenever the user typed.
describe('comparison range bound', () => {
  const range = (startDate: string, endDate: string, period?: string) => ({
    ...query(2),
    startDate,
    endDate,
    ...(period ? { period } : {}),
  });

  it('accepts a year of daily buckets', () => {
    expect(
      getCategoryComparisonQuerySchema.safeParse(
        range('2026-01-01', '2026-12-31', 'daily'),
      ).success,
    ).toBe(true);
  });

  it('rejects a century of daily buckets', () => {
    expect(
      getCategoryComparisonQuerySchema.safeParse(
        range('1900-01-01', '2026-12-31', 'daily'),
      ).success,
    ).toBe(false);
  });

  it('accepts the same range at a coarser period', () => {
    expect(
      getCategoryComparisonQuerySchema.safeParse(
        range('1900-01-01', '2026-12-31', 'yearly'),
      ).success,
    ).toBe(true);
  });
});
