import { parseISO } from 'date-fns';
import type {
  CategoryComparison,
  ComparisonCell,
  ComparisonMeasure,
  TrendPeriod,
} from '@/types/trends';
import { toDayString } from '@/shared/dates';
import type { AppFormatter } from '@/i18n/useAppFormat';
import type { T } from '@/i18n/useT.types';

type ComparisonBucketLabelInput = {
  bucket: { key: string; startDate: string };
  period: TrendPeriod;
  formatter: AppFormatter;
};

export function selectMeasure(cell: ComparisonCell, measure: ComparisonMeasure): number {
  if (measure === 'income') {
    return cell.income;
  }
  if (measure === 'expense') {
    return cell.expense;
  }
  return cell.net;
}

/** A dense bucket holds one cell per series, so a series index always has a cell. */
export function cellAt({
  cells,
  seriesIndex,
}: {
  cells: ComparisonCell[];
  seriesIndex: number;
}): ComparisonCell {
  const cell = cells[seriesIndex];
  if (!cell) {
    throw new Error(`bucket has no cell for series ${seriesIndex} (cells: ${cells.length})`);
  }
  return cell;
}

export function seriesColor(index: number, palette: string[]): string {
  return palette[index % palette.length] ?? '';
}

export function formatBucketLabel({
  bucket,
  period,
  formatter,
}: ComparisonBucketLabelInput): string {
  switch (period) {
    case 'yearly':
      return formatter.year(bucket.startDate);
    case 'weekly':
      return bucket.key;
    default:
      return formatter.monthShort(bucket.startDate);
  }
}

function escapeCsvValue(value: string | number): string {
  const raw = String(value);
  return `"${raw.replace(/"/g, '""')}"`;
}

export function comparisonToCsv({
  comparison,
  measure,
  t,
  formatter,
}: {
  comparison: CategoryComparison;
  measure: ComparisonMeasure;
  t: T;
  formatter: AppFormatter;
}): string {
  const totalLabel = t('trends.compare.total');
  const header = [
    t('trends.compare.period'),
    ...comparison.series.map((series) => series.categoryName),
    totalLabel,
  ];

  const rows = comparison.buckets.map((bucket) => [
    formatBucketLabel({ bucket, period: comparison.period, formatter }),
    ...bucket.cells.map((cell) => selectMeasure(cell, measure)),
    selectMeasure(bucket.rowTotal, measure),
  ]);

  const totals = [
    totalLabel,
    ...comparison.series.map((series) => selectMeasure(series.total, measure)),
    selectMeasure(comparison.grandTotal, measure),
  ];

  return [header, ...rows, totals].map((row) => row.map(escapeCsvValue).join(',')).join('\n');
}

export function comparisonFileName(comparison: CategoryComparison): string {
  const start = toDayString(parseISO(comparison.startDate));
  const end = toDayString(parseISO(comparison.endDate));
  return `comparison_${comparison.period}_${start}_${end}.csv`;
}
