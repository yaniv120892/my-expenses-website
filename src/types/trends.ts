import type { ComparisonScope, TrendPeriod } from '@/shared/types/trends';
import type { TransactionType } from '@/shared/types/transaction';

export * from '@/shared/types/trends';
export type { TransactionType };

// Client-only UI state for the trends page.
export const TRENDS_VIEWS = ['overview', 'compare'] as const;

export type TrendsView = (typeof TRENDS_VIEWS)[number];

export interface TrendFilters {
  period: TrendPeriod;
  startDate: Date;
  endDate: Date;
  selectedCategory: string;
  transactionType: TransactionType;
  comparisonCategoryIds: string[];
  comparisonScope: ComparisonScope;
}
