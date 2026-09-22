import { z } from 'zod';
import { transactionFilterSchema } from '@/shared/schemas/transactions';
import { TransactionSummaryFilters } from '@/shared/types/transaction';

type TransactionQuery = z.infer<typeof transactionFilterSchema>;

/**
 * Routes speak `type`, services speak `transactionType`; a spread does not trip
 * the excess-property check, so the filter would silently drop.
 */
export function toTransactionFilters<T extends TransactionQuery>(
  query: T,
  userId: string,
): Omit<T, 'type'> & TransactionSummaryFilters {
  const { type, ...rest } = query;
  return { ...rest, transactionType: type, userId };
}
