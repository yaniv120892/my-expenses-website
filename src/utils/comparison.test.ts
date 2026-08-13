import { describe, expect, it } from 'vitest';
import {
  MEASURE_LABELS,
  comparisonFileName,
  comparisonToCsv,
  formatBucketLabel,
  selectMeasure,
  seriesColor,
} from '@/utils/comparison';
import {
  CategoryComparison,
  ComparisonCell,
  ComparisonSeries,
} from '@/types/trends';

const cell = (income: number, expense: number): ComparisonCell => ({
  income,
  expense,
  net: income - expense,
  count: 1,
});

const series = (
  categoryName: string,
  total: ComparisonCell,
): ComparisonSeries => ({
  categoryId: categoryName,
  categoryName,
  scope: 'EXACT',
  memberCategoryIds: [],
  total,
});

const comparison: CategoryComparison = {
  period: 'monthly',
  startDate: '2023-12-01',
  endDate: '2024-01-31',
  series: [series('Food, "fresh"', cell(0, 30)), series('Rent', cell(0, 100))],
  buckets: [
    {
      key: '2023-12',
      startDate: '2023-12-01',
      cells: [cell(0, 10), cell(0, 50)],
      rowTotal: cell(0, 60),
    },
    {
      key: '2024-01',
      startDate: '2024-01-01',
      cells: [cell(0, 20), cell(0, 50)],
      rowTotal: cell(0, 70),
    },
  ],
  grandTotal: cell(0, 130),
  hasOverlappingSeries: false,
};

describe('MEASURE_LABELS', () => {
  it('labels every measure', () => {
    expect(MEASURE_LABELS).toEqual({
      net: 'Net',
      expense: 'Spent',
      income: 'Received',
    });
  });
});

describe('selectMeasure', () => {
  it('picks the field matching the measure', () => {
    const c = cell(100, 40);
    expect(selectMeasure(c, 'income')).toBe(100);
    expect(selectMeasure(c, 'expense')).toBe(40);
    expect(selectMeasure(c, 'net')).toBe(60);
  });
});

describe('seriesColor', () => {
  it('wraps around the palette', () => {
    const palette = ['a', 'b', 'c'];
    expect(seriesColor(0, palette)).toBe('a');
    expect(seriesColor(2, palette)).toBe('c');
    expect(seriesColor(3, palette)).toBe('a');
    expect(seriesColor(5, palette)).toBe('c');
  });
});

describe('formatBucketLabel', () => {
  it('renders the year for yearly buckets', () => {
    expect(
      formatBucketLabel({ key: '2024', startDate: '2024-01-01' }, 'yearly'),
    ).toBe('2024');
  });

  it('uses the raw key for weekly buckets', () => {
    expect(
      formatBucketLabel({ key: '2024-W07', startDate: '2024-02-12' }, 'weekly'),
    ).toBe('2024-W07');
  });

  it('renders MMM yyyy for monthly buckets', () => {
    expect(
      formatBucketLabel({ key: '2023-12', startDate: '2023-12-01' }, 'monthly'),
    ).toBe('Dec 2023');
  });
});

describe('comparisonToCsv', () => {
  it('builds header, bucket rows and a totals row with CSV escaping', () => {
    const csv = comparisonToCsv(comparison, 'expense');
    expect(csv.split('\n')).toEqual([
      '"Period","Food, ""fresh""","Rent","Total"',
      '"Dec 2023","10","50","60"',
      '"Jan 2024","20","50","70"',
      '"Total","30","100","130"',
    ]);
  });

  it('respects the selected measure', () => {
    const csv = comparisonToCsv(comparison, 'net');
    expect(csv).toContain('"Dec 2023","-10","-50","-60"');
    expect(csv.endsWith('"Total","-30","-100","-130"')).toBe(true);
  });
});

describe('comparisonFileName', () => {
  it('embeds the period and both dates', () => {
    expect(comparisonFileName(comparison)).toBe(
      'comparison_monthly_2023-12-01_2024-01-31.csv',
    );
  });
});
