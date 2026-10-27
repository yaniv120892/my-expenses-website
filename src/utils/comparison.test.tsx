// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Locale } from '@yaniv120892/my-ui';
import { DesignTestProvider } from '@/test/renderWithClient';
import { useAppFormat } from '@/i18n/useAppFormat';
import { useT } from '@/i18n/useT';
import {
  cellAt,
  comparisonFileName,
  comparisonToCsv,
  formatBucketLabel,
  selectMeasure,
  seriesColor,
} from '@/utils/comparison';
import type { CategoryComparison, ComparisonCell, ComparisonSeries } from '@/types/trends';

const cell = (income: number, expense: number): ComparisonCell => ({
  income,
  expense,
  net: income - expense,
  count: 1,
});

const series = (categoryName: string, total: ComparisonCell): ComparisonSeries => ({
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

function renderI18n(locale: Locale = 'en') {
  return renderHook(() => ({ t: useT(), formatter: useAppFormat() }), {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <DesignTestProvider locale={locale}>{children}</DesignTestProvider>
    ),
  }).result.current;
}

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

  it('renders an empty palette as no color rather than crashing the chart', () => {
    expect(seriesColor(0, [])).toBe('');
  });
});

describe('cellAt', () => {
  it('returns the series cell of a dense bucket', () => {
    const c = cell(100, 40);
    expect(cellAt({ cells: [c], seriesIndex: 0 })).toBe(c);
  });

  it('fails loudly when the bucket is missing a series cell', () => {
    expect(() => cellAt({ cells: [cell(1, 0)], seriesIndex: 1 })).toThrow('no cell for series 1');
  });
});

describe('formatBucketLabel', () => {
  it('renders the year for yearly buckets', () => {
    const { formatter } = renderI18n();
    expect(
      formatBucketLabel({
        bucket: { key: '2024', startDate: '2024-01-01' },
        period: 'yearly',
        formatter,
      }),
    ).toBe('2024');
  });

  it('uses the raw key for weekly buckets', () => {
    const { formatter } = renderI18n();
    expect(
      formatBucketLabel({
        bucket: { key: '2024-W07', startDate: '2024-02-12' },
        period: 'weekly',
        formatter,
      }),
    ).toBe('2024-W07');
  });

  it('renders the short month and year for monthly buckets', () => {
    const { formatter } = renderI18n();
    expect(
      formatBucketLabel({
        bucket: { key: '2023-12', startDate: '2023-12-01' },
        period: 'monthly',
        formatter,
      }),
    ).toBe('Dec 2023');
  });

  it('names the month in Hebrew for a Hebrew reader', () => {
    const { formatter } = renderI18n('he');
    expect(
      formatBucketLabel({
        bucket: { key: '2023-12', startDate: '2023-12-01' },
        period: 'monthly',
        formatter,
      }),
    ).toContain('2023');
    expect(
      formatBucketLabel({
        bucket: { key: '2023-12', startDate: '2023-12-01' },
        period: 'monthly',
        formatter,
      }),
    ).toMatch(/דצמ/);
  });
});

describe('comparisonToCsv', () => {
  it('builds header, bucket rows and a totals row with CSV escaping', () => {
    const csv = comparisonToCsv({
      comparison,
      measure: 'expense',
      ...renderI18n(),
    });
    expect(csv.split('\n')).toEqual([
      '"Period","Food, ""fresh""","Rent","Total"',
      '"Dec 2023","10","50","60"',
      '"Jan 2024","20","50","70"',
      '"Total","30","100","130"',
    ]);
  });

  it('respects the selected measure', () => {
    const csv = comparisonToCsv({
      comparison,
      measure: 'net',
      ...renderI18n(),
    });
    expect(csv).toContain('"Dec 2023","-10","-50","-60"');
    expect(csv.endsWith('"Total","-30","-100","-130"')).toBe(true);
  });
});

describe('comparisonToCsv in Hebrew', () => {
  it('translates the period and total headers', () => {
    const csv = comparisonToCsv({
      comparison,
      measure: 'expense',
      ...renderI18n('he'),
    });
    const lines = csv.split('\n');
    expect(lines[0]).toBe('"תקופה","Food, ""fresh""' + '","Rent","סך הכול"');
    expect(lines[lines.length - 1]).toBe('"סך הכול","30","100","130"');
  });
});

describe('comparisonFileName', () => {
  it('embeds the period and both dates', () => {
    expect(comparisonFileName(comparison)).toBe('comparison_monthly_2023-12-01_2024-01-31.csv');
  });
});
