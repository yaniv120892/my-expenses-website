import { formatAmountWithOriginal } from '@/utils/format';
import { toDayString } from '@/shared/dates';
import type { Transaction } from '@/shared/types/transaction';

// One line per transaction, id first, so the agent can quote the row back to
// the user and pass the id to update_transaction or delete_transaction.
export function describeTransaction(transaction: Transaction): string {
  return [
    `id ${transaction.id}`,
    toDayString(transaction.date),
    transaction.description,
    formatAmountWithOriginal(transaction),
    transaction.category.name,
    transaction.type,
  ].join(' | ');
}

export function describeTransactions({
  transactions,
  emptyText,
}: {
  transactions: Transaction[];
  emptyText: string;
}): string {
  if (transactions.length === 0) {
    return emptyText;
  }
  return transactions.map(describeTransaction).join('\n');
}
