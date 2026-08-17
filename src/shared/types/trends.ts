// Type-only so pulling MAX_COMPARISON_SERIES into a client component cannot
// drag @prisma/client along with it.
import type { TransactionType } from '@prisma/client';

/**
 * Most categories the comparison view can chart at once. Bounded by
 * theme.palette.charts.series.length — one distinct color per series — and
 * enforced by getCategoryComparisonQuerySchema, so the picker and the route
 * must read the same number.
 */
export const MAX_COMPARISON_SERIES = 8;

/**
 * Most periods one comparison may span. The series cap alone does not bound
 * the work: a 1900 start date with a daily period enumerates a bucket per day
 * server-side and hands recharts that many grouped bars. A year of days, or
 * three centuries of months, is already far past readable.
 */
export const MAX_COMPARISON_BUCKETS = 366;

export type TrendPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

export type TrendPoint = {
  date: string;
  amount: number;
  count: number;
};

export type CategoryTrendPoint = TrendPoint & {
  categoryId: string;
  categoryName: string;
};

export type SpendingTrend = {
  period: TrendPeriod;
  startDate: string;
  endDate: string;
  points: TrendPoint[];
  totalAmount: number;
  percentageChange: number;
  trend: 'up' | 'down' | 'stable';
};

export type CategorySpendingTrend = {
  period: TrendPeriod;
  startDate: string;
  endDate: string;
  points: CategoryTrendPoint[];
  totalAmount: number;
  percentageChange: number;
  trend: 'up' | 'down' | 'stable';
  categoryId: string;
  categoryName: string;
};

export type ComparisonScope = 'SUBTREE' | 'EXACT';

export type ComparisonMeasure = 'net' | 'income' | 'expense';

export type ComparisonCell = {
  income: number;
  expense: number;
  net: number;
  count: number;
};

export type ComparisonSeries = {
  categoryId: string;
  categoryName: string;
  scope: ComparisonScope;
  /** Ids actually summed — the category plus its descendants under SUBTREE. */
  memberCategoryIds: string[];
  total: ComparisonCell;
};

export type ComparisonBucket = {
  key: string;
  startDate: string;
  /** Positionally aligned with CategoryComparison.series. */
  cells: ComparisonCell[];
  rowTotal: ComparisonCell;
};

export type CategoryComparison = {
  period: TrendPeriod;
  startDate: string;
  endDate: string;
  series: ComparisonSeries[];
  /** Ascending and dense — empty periods are present with zeroed cells. */
  buckets: ComparisonBucket[];
  grandTotal: ComparisonCell;
  /** A selected category is an ancestor of another, so totals double count. */
  hasOverlappingSeries: boolean;
};

export interface GetCategoryComparisonRequest {
  startDate: Date;
  endDate: Date;
  period: TrendPeriod;
  categoryIds: string[];
  scope: ComparisonScope;
  transactionType?: TransactionType;
}

export interface GetSpendingTrendsRequest {
  startDate?: Date;
  endDate?: Date;
  period: TrendPeriod;
  categoryId?: string;
  transactionType?: TransactionType;
}
