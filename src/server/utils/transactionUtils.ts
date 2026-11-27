import type { Transaction, TransactionType } from '@/shared/types/transaction';

const TYPE_ICON = {
  EXPENSE: '📉',
  INCOME: '📈',
} satisfies Record<TransactionType, string>;

export function formatTransaction(transaction: Transaction): string {
  const formattedDate = new Date(transaction.date).toISOString().split('T')[0];

  return `${TYPE_ICON[transaction.type]} ${transaction.description} - ${transaction.value}
📂 ${transaction.category?.name || 'N/A'}  📅 ${formattedDate}`;
}
