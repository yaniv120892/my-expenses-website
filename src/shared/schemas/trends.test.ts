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
