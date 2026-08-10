export type TrendPeriod = 'weekly' | 'monthly' | 'yearly';
export type TransactionType = 'EXPENSE' | 'INCOME';

export type TrendPoint = {
  date: string;
  amount: number;
  count: number;
};

export type CategoryTrendPoint = TrendPoint & {
  categoryId: string;
  categoryName: string;
};

export interface SpendingTrend {
  points: {
    date: string;
    amount: number;
  }[];
  totalAmount: number;
  percentageChange: number;
  trend: 'up' | 'down' | 'stable';
}

export interface CategorySpendingTrend extends SpendingTrend {
  categoryId: string;
  categoryName: string;
}

export type ComparisonScope = 'SUBTREE' | 'EXACT';

export type ComparisonMeasure = 'net' | 'income' | 'expense';

export type ComparisonCell = {
  income: number;
  expense: number;
  net: number;
  count: number;
};

export interface ComparisonSeries {
  categoryId: string;
  categoryName: string;
  scope: ComparisonScope;
  memberCategoryIds: string[];
  total: ComparisonCell;
}

export interface ComparisonBucket {
  key: string;
  startDate: string;
  /** Positionally aligned with CategoryComparison.series. */
  cells: ComparisonCell[];
  rowTotal: ComparisonCell;
}

export interface CategoryComparison {
  period: TrendPeriod;
  startDate: string;
  endDate: string;
  series: ComparisonSeries[];
  /** Ascending and dense — empty periods are present with zeroed cells. */
  buckets: ComparisonBucket[];
  grandTotal: ComparisonCell;
  /** A selected category is an ancestor of another, so totals double count. */
  hasOverlappingSeries: boolean;
}

export type TrendsView = 'overview' | 'compare';

export interface TrendFilters {
  period: TrendPeriod;
  startDate: Date;
  endDate: Date;
  selectedCategory: string;
  transactionType: TransactionType;
  comparisonCategoryIds: string[];
  comparisonScope: ComparisonScope;
}
