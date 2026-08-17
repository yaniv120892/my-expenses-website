import { format } from 'date-fns';
import { parse } from 'json2csv';
import { Transaction } from '@/shared/types/transaction';

const FIELDS = ['date', 'description', 'value', 'type', 'categoryName'];

/** Excel only detects UTF-8 from a BOM, and category names may be Hebrew. */
export const CSV_BOM = '\uFEFF';

/**
 * The one transactions-CSV shape: the user-facing export, the monthly report
 * attachment and the nightly backup are all this same file.
 */
export function buildTransactionsCsv(transactions: Transaction[]): string {
  const rows = transactions.map((transaction) => ({
    date: format(new Date(transaction.date), 'yyyy-MM-dd'),
    description: transaction.description,
    value: transaction.value,
    type: transaction.type,
    categoryName: transaction.category?.name || '',
  }));

  return parse(rows, { fields: FIELDS });
}

/**
 * Named for the range it covers, falling back to the day it was taken. `now`
 * is injected so the fallback is testable.
 */
export function transactionsCsvFileName(
  range: { startDate?: Date; endDate?: Date },
  now: Date = new Date(),
): string {
  if (range.startDate && range.endDate) {
    const start = format(range.startDate, 'yyyy-MM-dd');
    const end = format(range.endDate, 'yyyy-MM-dd');
    return `transactions_${start}_${end}.csv`;
  }
  return `transactions_${format(now, 'yyyy-MM-dd')}.csv`;
}
