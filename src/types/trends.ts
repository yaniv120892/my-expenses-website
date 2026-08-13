import type { ComparisonScope, TrendPeriod } from '@/shared/types/trends';
import type { TransactionType } from '@/shared/types/transaction';

export * from '@/shared/types/trends';
export type { TransactionType };

// Client-only UI state for the trends page.
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
