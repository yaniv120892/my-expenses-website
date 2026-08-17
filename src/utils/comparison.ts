import { format, parseISO } from 'date-fns';
import {
  CategoryComparison,
  ComparisonCell,
  ComparisonMeasure,
  TrendPeriod,
} from '@/types/trends';

export const MEASURE_LABELS: Record<ComparisonMeasure, string> = {
  net: 'Net',
  expense: 'Spent',
  income: 'Received',
};

export function selectMeasure(
  cell: ComparisonCell,
  measure: ComparisonMeasure,
): number {
  if (measure === 'income') return cell.income;
  if (measure === 'expense') return cell.expense;
  return cell.net;
}

/** Single source of truth for index -> color, so table, chart and legend agree. */
export function seriesColor(index: number, palette: string[]): string {
  return palette[index % palette.length];
}

export function formatBucketLabel(
  bucket: { key: string; startDate: string },
  period: TrendPeriod,
): string {
  const date = parseISO(bucket.startDate);
  if (period === 'yearly') return format(date, 'yyyy');
  if (period === 'weekly') return bucket.key;
  return format(date, 'MMM yyyy');
}

function escapeCsvValue(value: string | number): string {
  const raw = String(value);
  return `"${raw.replace(/"/g, '""')}"`;
}

export function comparisonToCsv(
  comparison: CategoryComparison,
  measure: ComparisonMeasure,
): string {
  const header = [
    'Period',
    ...comparison.series.map((series) => series.categoryName),
    'Total',
  ];

  const rows = comparison.buckets.map((bucket) => [
    formatBucketLabel(bucket, comparison.period),
    ...bucket.cells.map((cell) => selectMeasure(cell, measure)),
    selectMeasure(bucket.rowTotal, measure),
  ]);

  const totals = [
    'Total',
    ...comparison.series.map((series) => selectMeasure(series.total, measure)),
    selectMeasure(comparison.grandTotal, measure),
  ];

  return [header, ...rows, totals]
    .map((row) => row.map(escapeCsvValue).join(','))
    .join('\n');
}

export function comparisonFileName(comparison: CategoryComparison): string {
  const start = format(parseISO(comparison.startDate), 'yyyy-MM-dd');
  const end = format(parseISO(comparison.endDate), 'yyyy-MM-dd');
  return `comparison_${comparison.period}_${start}_${end}.csv`;
}
