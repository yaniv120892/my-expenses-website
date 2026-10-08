import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getRateToBase } = vi.hoisted(() => ({ getRateToBase: vi.fn() }));
vi.mock('@/server/services/exchangeRateService', () => ({
  default: { getRateToBase },
}));

import currencyConversionService from './currencyConversionService';
import type { TransactionAmount } from '@/shared/types/transaction';

const DAY = new Date(2026, 9, 7);

const statementConversion: TransactionAmount & { date: Date } = {
  value: 92.35,
  currency: 'USD',
  originalAmount: 25,
  exchangeRate: 3.694,
  exchangeRateDate: DAY,
  exchangeRateSource: 'STATEMENT',
  date: DAY,
};

describe('currencyConversionService.resolveAmount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps an ILS amount sent the pre-currency way, with no rate', async () => {
    expect(
      await currencyConversionService.resolveAmount({ value: 120.5 }, DAY),
    ).toEqual({
      value: 120.5,
      currency: 'ILS',
      originalAmount: 120.5,
      exchangeRate: null,
      exchangeRateDate: null,
      exchangeRateSource: null,
    });
    expect(getRateToBase).not.toHaveBeenCalled();
  });

  it('converts a foreign amount at the published rate for its date', async () => {
    getRateToBase.mockResolvedValue({
      rate: '3.07400000',
      rateDate: '2026-10-07',
    });

    const amount = await currencyConversionService.resolveAmount(
      { currency: 'USD', originalAmount: 19.99 },
      DAY,
    );

    expect(getRateToBase).toHaveBeenCalledWith('USD', DAY);
    expect(amount).toEqual({
      value: 61.45,
      currency: 'USD',
      originalAmount: 19.99,
      exchangeRate: 3.074,
      exchangeRateDate: new Date('2026-10-07T00:00:00Z'),
      exchangeRateSource: 'BANK_OF_ISRAEL',
    });
  });

  it('refuses, rather than converting 1:1, when no rate is available', async () => {
    getRateToBase.mockResolvedValue(null);

    await expect(
      currencyConversionService.resolveAmount(
        { currency: 'USD', originalAmount: 10 },
        DAY,
      ),
    ).rejects.toMatchObject({
      status: 422,
      message: expect.stringContaining('No exchange rate is available for USD'),
    });
  });

  it('takes an ILS amount the user knows as a manual conversion', async () => {
    const amount = await currencyConversionService.resolveAmount(
      { currency: 'EUR', originalAmount: 10, value: 40.12 },
      DAY,
    );

    expect(amount).toMatchObject({
      value: 40.12,
      currency: 'EUR',
      originalAmount: 10,
      exchangeRate: 4.012,
      exchangeRateSource: 'MANUAL',
    });
    expect(getRateToBase).not.toHaveBeenCalled();
  });

  it('applies a rate the user gives, rounding once at the end', async () => {
    const amount = await currencyConversionService.resolveAmount(
      { currency: 'GBP', originalAmount: 0.1 + 0.2, exchangeRate: 4.5 },
      DAY,
    );

    expect(amount).toMatchObject({
      value: 1.35,
      originalAmount: 0.3,
      exchangeRate: 4.5,
      exchangeRateSource: 'MANUAL',
    });
  });

  it('keeps an edit’s existing conversion when its amount and day are unchanged', async () => {
    const amount = await currencyConversionService.resolveAmount(
      { value: 92.35 },
      DAY,
      statementConversion,
    );

    expect(amount).toEqual({
      value: 92.35,
      currency: 'USD',
      originalAmount: 25,
      exchangeRate: 3.694,
      exchangeRateDate: DAY,
      exchangeRateSource: 'STATEMENT',
    });
    expect(getRateToBase).not.toHaveBeenCalled();
  });

  it('re-converts an edit that changes the foreign amount', async () => {
    getRateToBase.mockResolvedValue({
      rate: '3.70000000',
      rateDate: '2026-10-07',
    });

    const amount = await currencyConversionService.resolveAmount(
      { currency: 'USD', originalAmount: 30 },
      DAY,
      statementConversion,
    );

    expect(amount).toMatchObject({
      value: 111,
      originalAmount: 30,
      exchangeRateSource: 'BANK_OF_ISRAEL',
    });
  });

  it('turns a foreign transaction back into ILS when the edit says so', async () => {
    const amount = await currencyConversionService.resolveAmount(
      { currency: 'ILS', value: 90 },
      DAY,
      statementConversion,
    );

    expect(amount).toMatchObject({
      value: 90,
      currency: 'ILS',
      originalAmount: 90,
      exchangeRate: null,
      exchangeRateSource: null,
    });
  });

  it('requires the original amount of a new foreign transaction', async () => {
    await expect(
      currencyConversionService.resolveAmount(
        { currency: 'USD', value: 30 },
        DAY,
      ),
    ).rejects.toMatchObject({
      status: 400,
      message: 'originalAmount is required for an amount in USD',
    });
  });
});
