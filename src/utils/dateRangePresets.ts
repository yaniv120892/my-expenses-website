import { endOfMonth, endOfYear, parseISO, startOfMonth, startOfYear, subMonths } from 'date-fns';
import type { AppFormatter } from '@/i18n/useAppFormat';
import type { T } from '@/i18n/useT.types';
import { toDayString } from '@/shared/dates';

export type DateRangePresetId =
  'this-month' | 'last-month' | 'last-3-months' | 'this-year' | 'all-time';

export type DateRange = {
  startDate?: string;
  endDate?: string;
};

export type DateRangePreset = {
  id: DateRangePresetId;
  range: (now: Date) => DateRange;
};

const thisMonth = (now: Date): DateRange => ({
  startDate: toDayString(startOfMonth(now)),
  endDate: toDayString(endOfMonth(now)),
});

export const DATE_RANGE_PRESETS: DateRangePreset[] = [
  { id: 'this-month', range: thisMonth },
  {
    id: 'last-month',
    range: (now) => ({
      startDate: toDayString(startOfMonth(subMonths(now, 1))),
      endDate: toDayString(endOfMonth(subMonths(now, 1))),
    }),
  },
  {
    id: 'last-3-months',
    range: (now) => ({
      startDate: toDayString(startOfMonth(subMonths(now, 2))),
      endDate: toDayString(endOfMonth(now)),
    }),
  },
  {
    id: 'this-year',
    range: (now) => ({
      startDate: toDayString(startOfYear(now)),
      endDate: toDayString(endOfYear(now)),
    }),
  },
  { id: 'all-time', range: () => ({}) },
];

export function matchDateRangePreset(range: DateRange, now: Date): DateRangePresetId | undefined {
  return DATE_RANGE_PRESETS.find((preset) => {
    const { startDate, endDate } = preset.range(now);
    return startDate === range.startDate && endDate === range.endDate;
  })?.id;
}

export function defaultDateRange(now: Date = new Date()): DateRange {
  return thisMonth(now);
}

/** Names a whole calendar month or year rather than spelling out both bounds. */
export function describeDateRange({
  range,
  t,
  formatter,
}: {
  range: DateRange;
  t: T;
  formatter: AppFormatter;
}): string {
  const { startDate, endDate } = range;
  if (!startDate) {
    return endDate
      ? t('format.dateRange.until', { date: formatter.day(endDate) })
      : t('format.dateRange.allTime');
  }
  if (!endDate) {
    return t('format.dateRange.from', { date: formatter.day(startDate) });
  }

  const start = parseISO(startDate);

  if (startDate === toDayString(startOfYear(start)) && endDate === toDayString(endOfYear(start))) {
    return formatter.year(start);
  }
  if (
    startDate === toDayString(startOfMonth(start)) &&
    endDate === toDayString(endOfMonth(start))
  ) {
    return formatter.month(start);
  }
  return formatter.dateRange({ start: startDate, end: endDate });
}
