'use client';

import { useMemo } from 'react';
import { parseISO } from 'date-fns';
import { useFormat } from '@yaniv120892/my-ui';
import { BASE_CURRENCY, isForeignCurrency } from '@/shared/currency';
import type { ExchangeRateSource } from '@/shared/types/transaction';
import type { SubscriptionFrequency } from '@/types/subscription';
import type { TrendPeriod } from '@/types/trends';
import type { DisplayedAmount, Format, ScheduleSummaryInput } from './useAppFormat.types';
import { useT } from './useT';
import type { T } from './useT.types';

const SUNDAY_2023_01_01 = new Date(2023, 0, 1);
const ONE_DECIMAL = { minimumFractionDigits: 1, maximumFractionDigits: 1 };

/** parseISO, not `new Date`: the latter reads a date-only string as UTC midnight. */
function toDate(value: string | Date): Date {
  return typeof value === 'string' ? parseISO(value) : value;
}

export function createAppFormatter({ format, t }: { format: Format; t: T }) {
  const currency = (value: number) => format.currency({ value, currency: BASE_CURRENCY });
  const day = (value: string | Date) =>
    format.date({ value: toDate(value), options: { dateStyle: 'medium' } });

  return {
    ...format,
    currency,
    currencyRounded: (value: number) =>
      format.currency({
        value,
        currency: BASE_CURRENCY,
        options: { maximumFractionDigits: 0 },
      }),
    /** A percentage given in points (12.5, not 0.125), to one decimal. */
    percentagePoints: (points: number, options?: Intl.NumberFormatOptions) =>
      format.percent({
        value: points / 100,
        options: { ...ONE_DECIMAL, ...options },
      }),
    megabytes: (value: number) => format.number({ value, options: ONE_DECIMAL }),
    money: (amount: number, currencyCode: string) =>
      format.currency({ value: amount, currency: currencyCode }),
    day,
    dateTime: (value: string | Date) =>
      format.date({
        value: toDate(value),
        options: { dateStyle: 'short', timeStyle: 'short' },
      }),
    month: (value: string | Date) =>
      format.date({
        value: toDate(value),
        options: { month: 'long', year: 'numeric' },
      }),
    monthShort: (value: string | Date) =>
      format.date({
        value: toDate(value),
        options: { month: 'short', year: 'numeric' },
      }),
    year: (value: string | Date) =>
      format.date({ value: toDate(value), options: { year: 'numeric' } }),
    /** 1 is Sunday, as the schedule form stores it. */
    weekday: (dayOfWeek: number) => {
      const date = new Date(SUNDAY_2023_01_01);
      date.setDate(date.getDate() + ((dayOfWeek - 1) % 7));
      return format.date({ value: date, options: { weekday: 'long' } });
    },
    dateRange: ({ start, end }: { start?: string | Date; end?: string | Date }) =>
      `${start ? day(start) : ''} – ${end ? day(end) : ''}`,
    frequency: (frequency: SubscriptionFrequency) => t(`format.frequency.${frequency}`),
    exchangeRateSource: (source: ExchangeRateSource) => t(`format.exchangeRateSource.${source}`),
    trendDate: (date: string, period: TrendPeriod) => {
      switch (period) {
        case 'daily':
          return day(date);
        case 'weekly':
          return t('format.week', { week: date.split('-')[1] ?? date });
        case 'monthly':
          return format.date({
            value: parseISO(`${date}-01`),
            options: { month: 'short', year: 'numeric' },
          });
        default:
          return date;
      }
    },
    /**
     * The ILS amount, preceded by the original when the charge was in another
     * currency: "$25.00 · ₪92.35". An unknown ILS amount says so instead.
     */
    amountWithOriginal: (amount: DisplayedAmount) => {
      const baseText =
        amount.value === null
          ? t('format.baseAmountMissing', { currency: BASE_CURRENCY })
          : currency(amount.value);
      if (amount.currency === null) {
        return amount.value === null
          ? `${t('format.currencyUnknown', { amount: format.number({ value: amount.originalAmount }) })} · ${baseText}`
          : baseText;
      }
      if (!isForeignCurrency(amount.currency)) {
        return baseText;
      }
      return `${format.currency({ value: amount.originalAmount, currency: amount.currency })} · ${baseText}`;
    },
  };
}

export type AppFormatter = ReturnType<typeof createAppFormatter>;

export function useAppFormat(): AppFormatter {
  const format = useFormat();
  const t = useT();
  return useMemo(() => createAppFormatter({ format, t }), [format, t]);
}

export function scheduleSummary({
  schedule: { scheduleType, interval, dayOfWeek, dayOfMonth },
  t,
  formatter,
}: {
  schedule: ScheduleSummaryInput;
  t: T;
  formatter: AppFormatter;
}): string {
  const repeats = interval !== undefined && interval > 1;
  switch (scheduleType) {
    case 'DAILY':
      return repeats
        ? t('format.schedule.daily.other', { interval })
        : t('format.schedule.daily.one');
    case 'WEEKLY': {
      if (!dayOfWeek) {
        return t('format.schedule.weekly.missingDay');
      }
      const day = formatter.weekday(dayOfWeek);
      return repeats
        ? t('format.schedule.weekly.other', { interval, day })
        : t('format.schedule.weekly.one', { day });
    }
    case 'MONTHLY': {
      if (!dayOfMonth) {
        return t('format.schedule.monthly.missingDay');
      }
      return repeats
        ? t('format.schedule.monthly.other', { interval, day: dayOfMonth })
        : t('format.schedule.monthly.one', { day: dayOfMonth });
    }
    default:
      return '';
  }
}
