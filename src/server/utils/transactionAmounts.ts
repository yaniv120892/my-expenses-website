import type { ExchangeRateQuote } from '@/server/services/exchangeRateService';
import {
  convertAmount,
  type DecimalInput,
  impliedRate,
  toMoneyNumber,
  toRateString,
} from '@/server/utils/money';
import { BASE_CURRENCY } from '@/shared/currency';
import type {
  ExchangeRateSource,
  TransactionAmount,
} from '@/shared/types/transaction';

/** Just the amount fields, off a row that carries more. */
export function amountOf(row: TransactionAmount): TransactionAmount {
  return {
    value: row.value,
    currency: row.currency,
    originalAmount: row.originalAmount,
    exchangeRate: row.exchangeRate,
    exchangeRateDate: row.exchangeRateDate,
    exchangeRateSource: row.exchangeRateSource,
  };
}

export function baseAmount(value: DecimalInput): TransactionAmount {
  return {
    value: toMoneyNumber(value),
    currency: BASE_CURRENCY,
    originalAmount: toMoneyNumber(value),
    exchangeRate: null,
    exchangeRateDate: null,
    exchangeRateSource: null,
  };
}

/** A foreign amount whose ILS value is known, with the rate it implies. */
export function knownValueAmount(
  value: DecimalInput,
  originalAmount: DecimalInput,
  currency: string,
  date: Date,
  source: ExchangeRateSource,
): TransactionAmount {
  return {
    value: toMoneyNumber(value),
    currency,
    originalAmount: toMoneyNumber(originalAmount),
    exchangeRate: Number(impliedRate(value, originalAmount)),
    exchangeRateDate: date,
    exchangeRateSource: source,
  };
}

export function givenRateAmount(
  originalAmount: DecimalInput,
  currency: string,
  rate: DecimalInput,
  date: Date,
): TransactionAmount {
  return {
    value: convertAmount(originalAmount, rate),
    currency,
    originalAmount: toMoneyNumber(originalAmount),
    exchangeRate: Number(toRateString(rate)),
    exchangeRateDate: date,
    exchangeRateSource: 'MANUAL',
  };
}

export function publishedRateAmount(
  originalAmount: DecimalInput,
  currency: string,
  quote: ExchangeRateQuote,
): TransactionAmount {
  return {
    value: convertAmount(originalAmount, quote.rate),
    currency,
    originalAmount: toMoneyNumber(originalAmount),
    exchangeRate: Number(quote.rate),
    exchangeRateDate: new Date(`${quote.rateDate}T00:00:00Z`),
    exchangeRateSource: 'BANK_OF_ISRAEL',
  };
}
