import type { z } from 'zod/v4';
import type {
  comparePeriodsSchema,
  spendingTrendsSchema,
  summaryOutputSchema,
  transactionFilterSchema,
  trendOutputSchema,
} from '@/server/services/assistant/financeQuerySchemas';
import type { Transaction } from '@/shared/types/transaction';

export type TransactionFilterInput = z.infer<typeof transactionFilterSchema>;
export type ComparePeriodsInput = z.infer<typeof comparePeriodsSchema>;
export type SpendingTrendsInput = z.infer<typeof spendingTrendsSchema>;
export type SummaryResult = z.infer<typeof summaryOutputSchema>;
export type TrendResult = z.infer<typeof trendOutputSchema>;

/** A category name resolved to the ids of its whole subtree. */
export type ResolvedCategory = { ids: string[]; name: string };

export type FoundTransactions = {
  transactions: Transaction[];
  hasMore: boolean;
};
