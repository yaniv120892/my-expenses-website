import type { ExchangeRateSource } from '@/generated/prisma/enums';

/** An imported row's amount as written: decimals as strings. */
export type ImportedAmountColumns = {
  value: number | null;
  currency: string | null;
  originalAmount: string;
  exchangeRate: string | null;
  exchangeRateDate: Date | null;
  exchangeRateSource: ExchangeRateSource | null;
};
