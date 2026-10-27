import { ScheduleType } from '../types';
import { SubscriptionFrequency } from '../types/subscription';
import { BASE_CURRENCY, isForeignCurrency } from '@/shared/currency';

export const SUBSCRIPTION_FREQUENCIES: readonly SubscriptionFrequency[] = [
  'WEEKLY',
  'MONTHLY',
  'YEARLY',
];

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

function formatNumber(value: number) {
  return value.toLocaleString();
}

const moneyFormatters = new Map<string, Intl.NumberFormat>();

function formatMoney(amount: number, currency: string) {
  let formatter = moneyFormatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat(currency === BASE_CURRENCY ? 'he-IL' : 'en-US', {
      style: 'currency',
      currency,
    });
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
    amount.value === null ? `${BASE_CURRENCY} amount missing` : formatCurrencyPlain(amount.value);
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
  const baseIntervalText = interval && interval > 1 ? `every ${interval} ` : 'every ';
  if (scheduleType === 'DAILY') {
    return `Runs ${baseIntervalText.trim()} day${interval && interval > 1 ? 's' : ''}.`;
  }
  if (scheduleType === 'WEEKLY') {
    if (!dayOfWeek) {
      return 'Choose a day of week.';
    }
    const weekInterval = interval && interval > 1 ? `every ${interval} weeks` : 'every week';
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return `Runs ${weekInterval} on ${days[(dayOfWeek - 1) % 7]}.`;
  }
  if (scheduleType === 'MONTHLY') {
    if (!dayOfMonth) {
      return 'Choose a day of month.';
    }
    const monthInterval = interval && interval > 1 ? `every ${interval} months` : 'every month';
    return `Runs ${monthInterval} on day ${dayOfMonth}.`;
  }
  return '';
}
