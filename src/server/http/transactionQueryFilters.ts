import {
  TransactionSummaryFilters,
  TransactionType,
} from '@/shared/types/transaction';

interface TransactionQueryFilters {
  startDate?: Date;
  endDate?: Date;
  categoryId?: string;
  type?: TransactionType;
  searchTerm?: string;
}

/**
 * Routes speak `type`, the service layer speaks `transactionType`. Spreading a
 * query straight into a service silently drops the filter — a spread does not
 * trip the excess-property check — so the rename lives here only.
 */
export function toTransactionFilters<T extends TransactionQueryFilters>(
  query: T,
  userId: string,
): Omit<T, 'type'> & TransactionSummaryFilters {
  const { type, ...rest } = query;
  return { ...rest, transactionType: type, userId };
}
