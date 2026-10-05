import { QueryClient } from '@tanstack/react-query';
import { pendingTransactionKeys } from '@/hooks/usePendingTransactionsQuery';
import { transactionKeys } from '@/hooks/useTransactionsQuery';
import { trendKeys } from '@/hooks/useTrendsQuery';
import { dashboardKeys } from '@/hooks/useDashboardQuery';

export function invalidateTransactionData(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: pendingTransactionKeys.lists() });
  queryClient.invalidateQueries({ queryKey: transactionKeys.lists() });
  queryClient.invalidateQueries({ queryKey: transactionKeys.summaries() });
  queryClient.invalidateQueries({ queryKey: trendKeys.all });
  queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
}
