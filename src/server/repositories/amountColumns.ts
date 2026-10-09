import type { ExchangeRateSource } from '@/generated/prisma/enums';
import {
  toMoneyNumber,
  toMoneyString,
  toRateString,
} from '@/server/utils/money';
import type { TransactionAmount } from '@/shared/types/transaction';
import type { ImportedAmount } from '@/shared/types/import';
import type { ImportedAmountColumns } from '@/server/repositories/amountColumns.types';

type DecimalColumn = { toString(): string };

type AmountColumnsRow = {
  value: number;
  currency: string;
  originalAmount: DecimalColumn;
  exchangeRate: DecimalColumn | null;
  exchangeRateDate: Date | null;
  exchangeRateSource: ExchangeRateSource | null;
};

type ImportedAmountColumnsRow = Omit<AmountColumnsRow, 'value' | 'currency'> & {
  value: number | null;
  currency: string | null;
};

export function toAmountColumns(amount: TransactionAmount) {
  return {
    ...toImportedAmountColumns(amount),
    value: amount.value,
    currency: amount.currency,
  };
}

export function fromAmountColumns(row: AmountColumnsRow): TransactionAmount {
  return {
    ...fromImportedAmountColumns(row),
    value: row.value,
    currency: row.currency,
  };
}

/** Decimals go to the database as strings, so no float rounds them on the way. */
export function toImportedAmountColumns(
  amount: ImportedAmount,
): ImportedAmountColumns {
  return {
    value: amount.value,
    currency: amount.currency,
    originalAmount: toMoneyString(amount.originalAmount),
    exchangeRate:
      amount.exchangeRate === null ? null : toRateString(amount.exchangeRate),
    exchangeRateDate: amount.exchangeRateDate,
    exchangeRateSource: amount.exchangeRateSource,
  };
}

export function fromImportedAmountColumns(
  row: ImportedAmountColumnsRow,
): ImportedAmount {
  return {
    value: row.value,
    currency: row.currency,
    originalAmount: toMoneyNumber(row.originalAmount),
    exchangeRate:
      row.exchangeRate === null ? null : Number(row.exchangeRate.toString()),
    exchangeRateDate: row.exchangeRateDate,
    exchangeRateSource: row.exchangeRateSource,
  };
}
