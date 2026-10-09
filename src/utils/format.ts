import { ScheduleType, Transaction } from '../types';
import type { ExchangeRateSource } from '@/shared/types/transaction';
import { SubscriptionFrequency } from '../types/subscription';
import { toDayString } from '@/shared/dates';
import { BASE_CURRENCY, isForeignCurrency } from '@/shared/currency';

export function formatTransactionDate(date: string) {
  return toDayString(new Date(date));
}

export function formatTransaction(transaction: Transaction) {
  return `${transaction.description} - (${
    transaction.category?.name || 'N/A'
  }) on ${formatTransactionDate(transaction.date)}`;
}

export function formatNumber(value: number) {
  return value.toLocaleString();
}

const SUBSCRIPTION_FREQUENCY_LABELS: Record<SubscriptionFrequency, string> = {
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  YEARLY: 'Yearly',
};

// Listed rather than derived from the labels, because Object.keys widens to
// string[]. The Record above still fails to compile if a frequency has no label.
export const SUBSCRIPTION_FREQUENCIES: readonly SubscriptionFrequency[] = [
  'WEEKLY',
  'MONTHLY',
  'YEARLY',
];

export function formatSubscriptionFrequency(
  frequency: SubscriptionFrequency,
): string {
  return SUBSCRIPTION_FREQUENCY_LABELS[frequency];
}

const ilsFormatter = new Intl.NumberFormat('he-IL', {
  style: 'currency',
  currency: 'ILS',
});

export function formatCurrency(value: number) {
  return ilsFormatter.format(value);
}

// he-IL currency output carries invisible directionality marks and a
// non-breaking space, which are noise in Telegram text and model prompts.
export function formatCurrencyPlain(value: number) {
  return formatCurrency(value)
    .replace(/[\u200e\u200f]/g, '')
    .replace(/\u00a0/g, ' ');
}

const ilsRoundedFormatter = new Intl.NumberFormat('he-IL', {
  style: 'currency',
  currency: 'ILS',
  maximumFractionDigits: 0,
});

export function formatCurrencyRounded(value: number) {
  return ilsRoundedFormatter.format(value);
}

export const EXCHANGE_RATE_SOURCE_LABELS: Record<ExchangeRateSource, string> = {
  STATEMENT: 'card statement',
  BANK_OF_ISRAEL: 'Bank of Israel rate',
  MANUAL: 'entered by hand',
};

const moneyFormatters = new Map<string, Intl.NumberFormat>();

export function formatMoney(amount: number, currency: string) {
  let formatter = moneyFormatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat(
      currency === BASE_CURRENCY ? 'he-IL' : 'en-US',
      { style: 'currency', currency },
    );
    moneyFormatters.set(currency, formatter);
  }
  return formatter.format(amount);
}

type DisplayedAmount = {
  value: number | null;
  currency: string | null;
  originalAmount: number;
};

/**
 * The ILS amount, preceded by the original when the charge was in another
 * currency: "$25.00 · ₪92.35". An unknown ILS amount says so instead of
 * showing a number.
 */
export function formatAmountWithOriginal(amount: DisplayedAmount) {
  const baseText =
    amount.value === null
      ? `${BASE_CURRENCY} amount missing`
      : formatCurrencyPlain(amount.value);
  if (amount.currency === null) {
    return amount.value === null
      ? `${formatNumber(amount.originalAmount)} (currency unknown) · ${baseText}`
      : baseText;
  }
  if (!isForeignCurrency(amount.currency)) {
    return baseText;
  }
  return `${formatMoney(amount.originalAmount, amount.currency)} · ${baseText}`;
}

export function translateToScheduleSummary(
  scheduleType: ScheduleType,
  interval: number | undefined,
  dayOfWeek: number | undefined,
  dayOfMonth: number | undefined,
) {
  const baseIntervalText =
    interval && interval > 1 ? `every ${interval} ` : 'every ';
  if (scheduleType === 'DAILY') {
    return `Runs ${baseIntervalText.trim()} day${
      interval && interval > 1 ? 's' : ''
    }.`;
  }
  if (scheduleType === 'WEEKLY') {
    if (!dayOfWeek) {
      return 'Choose a day of week.';
    }
    const weekInterval =
      interval && interval > 1 ? `every ${interval} weeks` : 'every week';
    const days = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];
    return `Runs ${weekInterval} on ${days[(dayOfWeek - 1) % 7]}.`;
  }
  if (scheduleType === 'MONTHLY') {
    if (!dayOfMonth) {
      return 'Choose a day of month.';
    }
    const monthInterval =
      interval && interval > 1 ? `every ${interval} months` : 'every month';
    return `Runs ${monthInterval} on day ${dayOfMonth}.`;
  }
  return '';
}
