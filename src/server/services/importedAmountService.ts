import { HttpError } from '@/server/http/errors';
import exchangeRateService, {
  type ExchangeRateQuote,
} from '@/server/services/exchangeRateService';
import {
  convertAmount,
  impliedRate,
  isSameMoney,
  toMoneyNumber,
} from '@/server/utils/money';
import { BASE_CURRENCY, isForeignCurrency } from '@/shared/currency';
import { toDayString } from '@/shared/dates';
import type { ImportedAmount } from '@/shared/types/import';
import type { TransactionAmount } from '@/shared/types/transaction';
import { formatAmountWithOriginal } from '@/utils/format';

/** What the extraction service reports about one row's amount. */
export type ExtractedAmount = {
  value: number;
  date: Date;
  originalAmount?: number;
  originalCurrency?: string;
  chargedAmount?: number;
  chargedCurrency?: string;
  currencyAmbiguous?: boolean;
};

type RateLookup = (
  currency: string,
  date: Date,
) => Promise<ExchangeRateQuote | null>;

class ImportedAmountService {
  /**
   * A billed ILS amount on the statement is the conversion and is never
   * converted again. Only a foreign amount the statement did not bill is
   * converted, at the published rate for its date; without one, or when the
   * row's currency cannot be told, the ILS amount stays unknown.
   */
  public async resolveExtractedAmounts(
    rows: ExtractedAmount[],
  ): Promise<ImportedAmount[]> {
    const lookupRate = this.memoizedRateLookup();
    return Promise.all(
      rows.map((row) => this.resolveExtractedAmount(row, lookupRate)),
    );
  }

  /**
   * The amount a transaction created or merged from an imported row gets. An
   * ILS amount the user enters (or changes) wins; otherwise the row's own, or
   * failing that a merge target's conversion of the same foreign charge.
   */
  public resolveApprovedAmount(
    row: ImportedAmount & { date: Date },
    requestedValue: number | null,
    mergeTarget?: TransactionAmount,
  ): TransactionAmount {
    const keepsRowValue =
      row.value !== null &&
      (requestedValue === null || isSameMoney(requestedValue, row.value));
    if (keepsRowValue && row.value !== null) {
      return row.currency !== null && isForeignCurrency(row.currency)
        ? {
            value: row.value,
            currency: row.currency,
            originalAmount: row.originalAmount,
            exchangeRate: row.exchangeRate,
            exchangeRateDate: row.exchangeRateDate,
            exchangeRateSource: row.exchangeRateSource,
          }
        : baseAmount(row.value);
    }

    if (requestedValue !== null) {
      return row.currency !== null && isForeignCurrency(row.currency)
        ? {
            value: toMoneyNumber(requestedValue),
            currency: row.currency,
            originalAmount: row.originalAmount,
            exchangeRate: Number(
              impliedRate(requestedValue, row.originalAmount),
            ),
            exchangeRateDate: row.date,
            exchangeRateSource: 'MANUAL',
          }
        : baseAmount(requestedValue);
    }

    const mergeTargetHasSameCharge =
      mergeTarget !== undefined &&
      mergeTarget.currency === row.currency &&
      isSameMoney(mergeTarget.originalAmount, row.originalAmount);
    if (mergeTargetHasSameCharge) {
      return mergeTarget;
    }

    throw new HttpError(
      422,
      `The ${BASE_CURRENCY} amount of this charge (${formatAmountWithOriginal(row)}) is not known. Enter it before approving.`,
    );
  }

  private async resolveExtractedAmount(
    row: ExtractedAmount,
    lookupRate: RateLookup,
  ): Promise<ImportedAmount> {
    const reportsCurrency =
      row.originalAmount !== undefined ||
      row.originalCurrency !== undefined ||
      row.chargedAmount !== undefined ||
      row.chargedCurrency !== undefined ||
      row.currencyAmbiguous !== undefined;
    // An extraction service that predates currencies reported ILS amounts only.
    if (!reportsCurrency) {
      return baseAmount(row.value);
    }

    const originalAmount = row.originalAmount ?? row.value;
    const originalCurrency = row.originalCurrency ?? null;

    if (row.chargedAmount !== undefined) {
      const chargedCurrency = row.chargedCurrency ?? BASE_CURRENCY;
      if (chargedCurrency === BASE_CURRENCY) {
        return this.billedInBase(
          row.chargedAmount,
          originalAmount,
          originalCurrency,
          row,
        );
      }
      return this.convertAtPublishedRate(
        row.chargedAmount,
        chargedCurrency,
        row.date,
        lookupRate,
      );
    }

    if (row.currencyAmbiguous) {
      return unknownAmount(originalAmount, originalCurrency);
    }
    if (originalCurrency === null || originalCurrency === BASE_CURRENCY) {
      return baseAmount(originalAmount);
    }
    return this.convertAtPublishedRate(
      originalAmount,
      originalCurrency,
      row.date,
      lookupRate,
    );
  }

  private billedInBase(
    chargedAmount: number,
    originalAmount: number,
    originalCurrency: string | null,
    row: ExtractedAmount,
  ): ImportedAmount {
    if (originalCurrency !== null && isForeignCurrency(originalCurrency)) {
      return {
        value: toMoneyNumber(chargedAmount),
        currency: originalCurrency,
        originalAmount: toMoneyNumber(originalAmount),
        exchangeRate: Number(impliedRate(chargedAmount, originalAmount)),
        exchangeRateDate: row.date,
        exchangeRateSource: 'STATEMENT',
      };
    }
    const originalIsTheBilledAmount =
      !row.currencyAmbiguous && isSameMoney(originalAmount, chargedAmount);
    if (originalCurrency === BASE_CURRENCY || originalIsTheBilledAmount) {
      return baseAmount(chargedAmount);
    }
    // The ILS billed is certain; which currency the original was in is not.
    return {
      ...unknownAmount(originalAmount, null),
      value: toMoneyNumber(chargedAmount),
    };
  }

  private async convertAtPublishedRate(
    originalAmount: number,
    currency: string,
    date: Date,
    lookupRate: RateLookup,
  ): Promise<ImportedAmount> {
    const quote = await lookupRate(currency, date);
    if (!quote) {
      return unknownAmount(originalAmount, currency);
    }
    return {
      value: convertAmount(originalAmount, quote.rate),
      currency,
      originalAmount: toMoneyNumber(originalAmount),
      exchangeRate: Number(quote.rate),
      exchangeRateDate: new Date(`${quote.rateDate}T00:00:00Z`),
      exchangeRateSource: 'BANK_OF_ISRAEL',
    };
  }

  // A statement repeats a currency and day across rows; one lookup serves them.
  private memoizedRateLookup(): RateLookup {
    const lookups = new Map<string, Promise<ExchangeRateQuote | null>>();
    return (currency, date) => {
      const key = `${currency}:${toDayString(date)}`;
      let lookup = lookups.get(key);
      if (!lookup) {
        lookup = exchangeRateService.getRateToBase(currency, date);
        lookups.set(key, lookup);
      }
      return lookup;
    };
  }
}

function baseAmount(value: number): TransactionAmount {
  return {
    value: toMoneyNumber(value),
    currency: BASE_CURRENCY,
    originalAmount: toMoneyNumber(value),
    exchangeRate: null,
    exchangeRateDate: null,
    exchangeRateSource: null,
  };
}

function unknownAmount(
  originalAmount: number,
  currency: string | null,
): ImportedAmount {
  return {
    value: null,
    currency,
    originalAmount: toMoneyNumber(originalAmount),
    exchangeRate: null,
    exchangeRateDate: null,
    exchangeRateSource: null,
  };
}

const importedAmountService = new ImportedAmountService();
export default importedAmountService;
