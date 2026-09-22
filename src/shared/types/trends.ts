// Type-only so pulling MAX_COMPARISON_SERIES into a client component cannot
// drag @prisma/client along with it.
import type { TransactionType } from '@prisma/client';

// One distinct color per series: theme.palette.charts.series.length.
export const MAX_COMPARISON_SERIES = 8;

// The series cap bounds width, not length: a 1900 start with a daily period
// would hand recharts a grouped bar per day.
export const MAX_COMPARISON_BUCKETS = 366;

export const TREND_PERIODS = ['daily', 'weekly', 'monthly', 'yearly'] as const;

export type TrendPeriod = (typeof TREND_PERIODS)[number];

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

export const COMPARISON_SCOPES = ['SUBTREE', 'EXACT'] as const;

export type ComparisonScope = (typeof COMPARISON_SCOPES)[number];

export const COMPARISON_MEASURES = ['net', 'income', 'expense'] as const;

export type ComparisonMeasure = (typeof COMPARISON_MEASURES)[number];

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
