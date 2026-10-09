import { isSameDay } from 'date-fns';
import { HttpError } from '@/server/http/errors';
import { CustomValidationError } from '@/server/errors/validationError';
import exchangeRateService from '@/server/services/exchangeRateService';
import { isSameMoney } from '@/server/utils/money';
import {
  pickAmountFields,
  baseAmount,
  givenRateAmount,
  impliedRateAmount,
  publishedRateAmount,
} from '@/server/utils/transactionAmounts';
import { BASE_CURRENCY } from '@/shared/currency';
import { toDayString } from '@/shared/dates';
import type {
  TransactionAmount,
  TransactionAmountInput,
} from '@/shared/types/transaction';

type ExistingAmount = TransactionAmount & { date: Date };

class CurrencyConversionService {
  /** Fails, rather than converting 1:1, when no rate can be had. */
  public async resolveAmount(
    input: TransactionAmountInput,
    date: Date,
    existing?: ExistingAmount,
  ): Promise<TransactionAmount> {
    const currency = input.currency ?? existing?.currency ?? BASE_CURRENCY;
    if (currency === BASE_CURRENCY) {
      return baseAmount(this.baseCurrencyValue(input));
    }

    const originalAmount = this.foreignOriginalAmount(
      input,
      currency,
      existing,
    );

    if (input.exchangeRate !== undefined) {
      return givenRateAmount(
        originalAmount,
        currency,
        input.exchangeRate,
        date,
      );
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
      return pickAmountFields(existing);
    }

    if (input.value !== undefined) {
      return impliedRateAmount(
        input.value,
        originalAmount,
        currency,
        date,
        'MANUAL',
      );
    }

    const quote = await exchangeRateService.getRateToBase(currency, date);
    if (!quote) {
      throw new HttpError(
        422,
        `No exchange rate is available for ${currency} on ${toDayString(date)}. Enter the amount charged in ${BASE_CURRENCY}, or an exchange rate.`,
      );
    }
    return publishedRateAmount(originalAmount, currency, quote);
  }

  private baseCurrencyValue(input: TransactionAmountInput): number {
    const amount = input.originalAmount ?? input.value;
    if (amount === undefined) {
      throw new CustomValidationError('An amount is required');
    }
    return amount;
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
}

const currencyConversionService = new CurrencyConversionService();
export default currencyConversionService;
