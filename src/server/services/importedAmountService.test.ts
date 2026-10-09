import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getRateToBase } = vi.hoisted(() => ({ getRateToBase: vi.fn() }));
vi.mock('@/server/services/exchangeRateService', () => ({
  default: { getRateToBase },
}));

import importedAmountService from './importedAmountService';
import type { ImportedAmount } from '@/shared/types/import';

const DAY = new Date(2026, 7, 8);

describe('importedAmountService.resolveExtractedAmounts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const resolveOne = async (
    row: Parameters<
      typeof importedAmountService.resolveExtractedAmounts
    >[0][number],
  ) => (await importedAmountService.resolveExtractedAmounts([row]))[0];

  it('reads a row from an extraction service without currencies as ILS', async () => {
    expect(await resolveOne({ value: 140.4, date: DAY })).toEqual({
      value: 140.4,
      currency: 'ILS',
      originalAmount: 140.4,
      exchangeRate: null,
      exchangeRateDate: null,
      exchangeRateSource: null,
    });
  });

  it('takes the billed ILS amount as the conversion and never converts it again', async () => {
    expect(
      await resolveOne({
        value: 92.35,
        date: DAY,
        originalAmount: 25,
        originalCurrency: 'USD',
        chargedAmount: 92.35,
        chargedCurrency: 'ILS',
      }),
    ).toEqual({
      value: 92.35,
      currency: 'USD',
      originalAmount: 25,
      exchangeRate: 3.694,
      exchangeRateDate: DAY,
      exchangeRateSource: 'STATEMENT',
    });
    expect(getRateToBase).not.toHaveBeenCalled();
  });

  it('converts an unbilled foreign refund at the published rate', async () => {
    getRateToBase.mockResolvedValue({
      rate: '4.01000000',
      rateDate: '2026-08-07',
    });

    expect(
      await resolveOne({
        value: 10,
        date: DAY,
        originalAmount: 10,
        originalCurrency: 'EUR',
      }),
    ).toMatchObject({
      value: 40.1,
      currency: 'EUR',
      originalAmount: 10,
      exchangeRateSource: 'BANK_OF_ISRAEL',
    });
  });

  it('leaves the ILS amount unknown, not 1:1, when no rate exists', async () => {
    getRateToBase.mockResolvedValue(null);

    expect(
      await resolveOne({
        value: 10,
        date: DAY,
        originalAmount: 10,
        originalCurrency: 'EUR',
      }),
    ).toMatchObject({ value: null, currency: 'EUR', originalAmount: 10 });
  });

  it('leaves an ambiguous row without a billed amount unknown in currency and value', async () => {
    expect(
      await resolveOne({
        value: 10,
        date: DAY,
        originalAmount: 10,
        currencyAmbiguous: true,
      }),
    ).toMatchObject({ value: null, currency: null, originalAmount: 10 });
    expect(getRateToBase).not.toHaveBeenCalled();
  });

  it('keeps a billed ILS amount whose original currency is not recognised', async () => {
    expect(
      await resolveOne({
        value: 30.5,
        date: DAY,
        originalAmount: 1200,
        chargedAmount: 30.5,
        currencyAmbiguous: true,
      }),
    ).toMatchObject({ value: 30.5, currency: null, originalAmount: 1200 });
  });

  it('reads an ILS row with matching original and billed amounts as ILS', async () => {
    expect(
      await resolveOne({
        value: 96,
        date: DAY,
        originalAmount: 96,
        chargedAmount: 96,
      }),
    ).toMatchObject({ value: 96, currency: 'ILS', exchangeRate: null });
  });

  it('looks up one rate per currency and day across a statement', async () => {
    getRateToBase.mockResolvedValue({
      rate: '3.00000000',
      rateDate: '2026-08-07',
    });

    await importedAmountService.resolveExtractedAmounts([
      { value: 1, date: DAY, originalAmount: 1, originalCurrency: 'USD' },
      { value: 2, date: DAY, originalAmount: 2, originalCurrency: 'USD' },
      { value: 3, date: DAY, originalAmount: 3, originalCurrency: 'EUR' },
    ]);

    expect(getRateToBase).toHaveBeenCalledTimes(2);
  });
});

describe('importedAmountService.resolveApprovedAmount', () => {
  const statementRow: ImportedAmount & { date: Date } = {
    value: 92.35,
    currency: 'USD',
    originalAmount: 25,
    exchangeRate: 3.694,
    exchangeRateDate: DAY,
    exchangeRateSource: 'STATEMENT',
    date: DAY,
  };
  const unknownRow: ImportedAmount & { date: Date } = {
    ...statementRow,
    value: null,
    exchangeRate: null,
    exchangeRateDate: null,
    exchangeRateSource: null,
  };

  it('keeps the statement conversion when the confirmed ILS amount is unchanged', () => {
    expect(
      importedAmountService.resolveApprovedAmount(statementRow, 92.35),
    ).toMatchObject({ value: 92.35, exchangeRateSource: 'STATEMENT' });
  });

  it('records an ILS amount the user enters as a manual rate', () => {
    expect(
      importedAmountService.resolveApprovedAmount(unknownRow, 80),
    ).toMatchObject({
      value: 80,
      currency: 'USD',
      originalAmount: 25,
      exchangeRate: 3.2,
      exchangeRateSource: 'MANUAL',
    });
  });

  it('refuses to approve a row whose ILS amount is unknown', () => {
    expect(() =>
      importedAmountService.resolveApprovedAmount(unknownRow),
    ).toThrow(/is not known\. Enter it before approving/);
  });

  it('borrows a merge target’s conversion of the same foreign charge', () => {
    const target = {
      value: 76.75,
      currency: 'USD',
      originalAmount: 25,
      exchangeRate: 3.07,
      exchangeRateDate: DAY,
      exchangeRateSource: 'BANK_OF_ISRAEL' as const,
    };
    expect(
      importedAmountService.resolveApprovedAmount(
        unknownRow,
        undefined,
        target,
      ),
    ).toBe(target);
  });

  it('approves a row of unknown currency as the ILS amount entered', () => {
    expect(
      importedAmountService.resolveApprovedAmount(
        { ...unknownRow, currency: null },
        41.5,
      ),
    ).toMatchObject({
      value: 41.5,
      currency: 'ILS',
      originalAmount: 41.5,
      exchangeRate: null,
    });
  });
});
