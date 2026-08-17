import { z } from 'zod';
import { transactionFilterSchema } from '@/shared/schemas/transactions';
import { TransactionSummaryFilters } from '@/shared/types/transaction';

type TransactionQuery = z.infer<typeof transactionFilterSchema>;

/**
 * Routes speak `type`, the service layer speaks `transactionType`. Spreading a
 * query straight into a service silently drops the filter — a spread does not
 * trip the excess-property check — so the rename lives here only.
 */
export function toTransactionFilters<T extends TransactionQuery>(
  query: T,
  userId: string,
): Omit<T, 'type'> & TransactionSummaryFilters {
  const { type, ...rest } = query;
  return { ...rest, transactionType: type, userId };
}
