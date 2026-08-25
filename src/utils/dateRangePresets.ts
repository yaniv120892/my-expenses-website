import {
  endOfMonth,
  endOfYear,
  format,
  parseISO,
  startOfMonth,
  startOfYear,
  subMonths,
} from 'date-fns';
import { formatDateRange, formatDay } from '@/utils/dateUtils';
import { toDayString } from '@/shared/dates';

export type DateRangePresetId =
  'this-month' | 'last-month' | 'last-3-months' | 'this-year' | 'all-time';

export interface DateRange {
  startDate?: string;
  endDate?: string;
}

export interface DateRangePreset {
  id: DateRangePresetId;
  label: string;
  range: (now: Date) => DateRange;
}

const thisMonth = (now: Date): DateRange => ({
  startDate: toDayString(startOfMonth(now)),
  endDate: toDayString(endOfMonth(now)),
});

export const DATE_RANGE_PRESETS: DateRangePreset[] = [
  { id: 'this-month', label: 'This month', range: thisMonth },
  {
    id: 'last-month',
    label: 'Last month',
    range: (now) => ({
      startDate: toDayString(startOfMonth(subMonths(now, 1))),
      endDate: toDayString(endOfMonth(subMonths(now, 1))),
    }),
  },
  {
    id: 'last-3-months',
    label: 'Last 3 months',
    range: (now) => ({
      startDate: toDayString(startOfMonth(subMonths(now, 2))),
      endDate: toDayString(endOfMonth(now)),
    }),
  },
  {
    id: 'this-year',
    label: 'This year',
    range: (now) => ({
      startDate: toDayString(startOfYear(now)),
      endDate: toDayString(endOfYear(now)),
    }),
  },
  { id: 'all-time', label: 'All time', range: () => ({}) },
];

export function matchDateRangePreset(
  range: DateRange,
  now: Date,
): DateRangePresetId | undefined {
  return DATE_RANGE_PRESETS.find((preset) => {
    const { startDate, endDate } = preset.range(now);
    return startDate === range.startDate && endDate === range.endDate;
  })?.id;
}

export function defaultDateRange(now: Date = new Date()): DateRange {
  return thisMonth(now);
}

/** Names a whole calendar month or year rather than spelling out both bounds. */
export function describeDateRange(range: DateRange): string {
  const { startDate, endDate } = range;
  if (!startDate) {
    return endDate ? `Until ${formatDay(endDate)}` : 'All time';
  }
  if (!endDate) {
    return `From ${formatDay(startDate)}`;
  }

  const start = parseISO(startDate);

  if (
    startDate === toDayString(startOfYear(start)) &&
    endDate === toDayString(endOfYear(start))
  ) {
    return format(start, 'yyyy');
  }
  if (
    startDate === toDayString(startOfMonth(start)) &&
    endDate === toDayString(endOfMonth(start))
  ) {
    return format(start, 'MMMM yyyy');
  }
  return formatDateRange(startDate, endDate, '–');
}
