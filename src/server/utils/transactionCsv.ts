import { format } from 'date-fns';
import { parse } from 'json2csv';
import { CSV_BOM } from '@/shared/csv';
import { Transaction } from '@/shared/types/transaction';
import { DAY_FORMAT } from '@/shared/dates';

const FIELDS = ['date', 'description', 'value', 'type', 'categoryName'];

// Excel and Sheets execute a cell whose text starts with one of these, and
// descriptions arrive from parsed bank statements rather than from us. A
// leading apostrophe is the spreadsheet convention for "this cell is text".
const FORMULA_TRIGGERS = ['=', '+', '-', '@', '\t', '\r'];

function asText(value: string): string {
  return FORMULA_TRIGGERS.some((trigger) => value.startsWith(trigger))
    ? `'${value}`
    : value;
}

function buildCsv(
  transactions: Transaction[],
  renderDate: (date: Date) => string,
  renderText: (value: string) => string,
): string {
  const rows = transactions.map((transaction) => ({
    date: renderDate(transaction.date),
    description: renderText(transaction.description),
    value: transaction.value,
    type: transaction.type,
    categoryName: renderText(transaction.category?.name || ''),
  }));

  return parse(rows, { fields: FIELDS });
}

/**
 * The transactions CSV a person opens in a spreadsheet — the user-facing
 * export and the monthly report attachment.
 */
export function buildTransactionsCsv(transactions: Transaction[]): string {
  return buildCsv(transactions, (date) => format(date, DAY_FORMAT), asText);
}

export function buildTransactionsCsvFile(transactions: Transaction[]): string {
  return `${CSV_BOM}${buildTransactionsCsv(transactions)}`;
}

/**
 * The nightly archive, which is a different file: it is the only copy of the
 * data, so it keeps the full instant and reproduces the text exactly as
 * stored. Nothing reads it as a spreadsheet.
 */
export function buildTransactionsBackupCsv(
  transactions: Transaction[],
): string {
  return buildCsv(
    transactions,
    (date) => date.toISOString(),
    (value) => value,
  );
}

/** `now` is injected so the fallback to today is testable. */
export function transactionsCsvFileName(
  range: { startDate?: Date; endDate?: Date },
  now: Date = new Date(),
): string {
  if (range.startDate && range.endDate) {
    const start = format(range.startDate, DAY_FORMAT);
    const end = format(range.endDate, DAY_FORMAT);
    return `transactions_${start}_${end}.csv`;
  }
  return `transactions_${format(now, DAY_FORMAT)}.csv`;
}
