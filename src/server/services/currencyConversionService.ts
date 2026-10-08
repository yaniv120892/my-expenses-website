import { isSameDay } from 'date-fns';
import { HttpError } from '@/server/http/errors';
import { CustomValidationError } from '@/server/errors/validationError';
import exchangeRateService from '@/server/services/exchangeRateService';
import {
  convertAmount,
  impliedRate,
  isSameMoney,
  toMoneyNumber,
  toRateString,
} from '@/server/utils/money';
import { BASE_CURRENCY } from '@/shared/currency';
import { toDayString } from '@/shared/dates';
import type {
  TransactionAmount,
  TransactionAmountInput,
} from '@/shared/types/transaction';

type ExistingAmount = TransactionAmount & { date: Date };

class CurrencyConversionService {
  /**
   * Decides the stored amount from what the caller stated. A rate the caller
   * gives wins, then an ILS amount the caller gives, then the published rate
   * for the transaction date; with none of these the request fails rather than
   * converting 1:1. An edit that leaves currency, original amount and day
   * alone keeps the conversion it already has.
   */
  public async resolveAmount(
    input: TransactionAmountInput,
    date: Date,
    existing?: ExistingAmount,
  ): Promise<TransactionAmount> {
    const currency = input.currency ?? existing?.currency ?? BASE_CURRENCY;
    if (currency === BASE_CURRENCY) {
      return this.baseCurrencyAmount(input);
    }

    const originalAmount = this.foreignOriginalAmount(
      input,
      currency,
      existing,
    );

    if (input.exchangeRate !== undefined) {
      return {
        value: convertAmount(originalAmount, input.exchangeRate),
        currency,
        originalAmount: toMoneyNumber(originalAmount),
        exchangeRate: Number(toRateString(input.exchangeRate)),
        exchangeRateDate: date,
        exchangeRateSource: 'MANUAL',
      };
    }

    if (
      existing &&
      this.keepsExistingConversion(
        input,
        currency,
        originalAmount,
        date,
        existing,
      )
    ) {
      return this.pickAmount(existing);
    }

    if (input.value !== undefined) {
      return {
        value: toMoneyNumber(input.value),
        currency,
        originalAmount: toMoneyNumber(originalAmount),
        exchangeRate: Number(impliedRate(input.value, originalAmount)),
        exchangeRateDate: date,
        exchangeRateSource: 'MANUAL',
      };
    }

    const quote = await exchangeRateService.getRateToBase(currency, date);
    if (!quote) {
      throw new HttpError(
        422,
        `No exchange rate is available for ${currency} on ${toDayString(date)}. Enter the amount charged in ${BASE_CURRENCY}, or an exchange rate.`,
      );
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

  private baseCurrencyAmount(input: TransactionAmountInput): TransactionAmount {
    const amount = input.originalAmount ?? input.value;
    if (amount === undefined) {
      throw new CustomValidationError('An amount is required');
    }
    return {
      value: toMoneyNumber(amount),
      currency: BASE_CURRENCY,
      originalAmount: toMoneyNumber(amount),
      exchangeRate: null,
      exchangeRateDate: null,
      exchangeRateSource: null,
    };
  }

  private foreignOriginalAmount(
    input: TransactionAmountInput,
    currency: string,
    existing: ExistingAmount | undefined,
  ): number {
    if (input.originalAmount !== undefined) {
      return input.originalAmount;
    }
    if (existing?.currency === currency) {
      return existing.originalAmount;
    }
    throw new CustomValidationError(
      `originalAmount is required for an amount in ${currency}`,
    );
  }

  private keepsExistingConversion(
    input: TransactionAmountInput,
    currency: string,
    originalAmount: number,
    date: Date,
    existing: ExistingAmount,
  ): boolean {
    const sameCharge =
      existing.currency === currency &&
      isSameMoney(existing.originalAmount, originalAmount) &&
      isSameDay(existing.date, date);
    const valueUnchanged =
      input.value === undefined || isSameMoney(input.value, existing.value);
    return sameCharge && valueUnchanged;
  }

  private pickAmount(amount: TransactionAmount): TransactionAmount {
    return {
      value: amount.value,
      currency: amount.currency,
      originalAmount: amount.originalAmount,
      exchangeRate: amount.exchangeRate,
      exchangeRateDate: amount.exchangeRateDate,
      exchangeRateSource: amount.exchangeRateSource,
    };
  }
}

const currencyConversionService = new CurrencyConversionService();
export default currencyConversionService;
