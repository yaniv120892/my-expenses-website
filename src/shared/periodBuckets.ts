import {
  differenceInCalendarDays,
  differenceInCalendarISOWeeks,
  differenceInCalendarMonths,
  differenceInCalendarYears,
  eachDayOfInterval,
  eachMonthOfInterval,
  eachWeekOfInterval,
  eachYearOfInterval,
  format,
} from 'date-fns';
import { TrendPeriod } from '@/shared/types/trends';
import { DAY_FORMAT, MONTH_FORMAT } from '@/shared/dates';

// Weekly uses ISO week-year + ISO week ('RRRR-II') so year-boundary weeks
// don't collide with week 1 of the same calendar year.
export const PERIOD_FORMATS: Record<string, string> = {
  daily: DAY_FORMAT,
  weekly: 'RRRR-II',
  monthly: MONTH_FORMAT,
  yearly: 'yyyy',
};

export function bucketKeyFor(date: Date, period: string): string {
  return format(date, PERIOD_FORMATS[period] ?? PERIOD_FORMATS.daily);
}

/**
 * Every bucket between start and end inclusive, ascending. Callers need the
 * full sequence rather than only the occupied buckets, so a period with no
 * transactions renders as zero instead of disappearing from the series.
 */
export function enumerateBuckets(
  startDate: Date,
  endDate: Date,
  period: TrendPeriod,
): { key: string; startDate: Date }[] {
  if (startDate > endDate) {
    return [];
  }

  const interval = { start: startDate, end: endDate };
  let starts: Date[];
  switch (period) {
    case 'daily':
      starts = eachDayOfInterval(interval);
      break;
    case 'weekly':
      // Monday-based to line up with the ISO week in the 'RRRR-II' key.
      starts = eachWeekOfInterval(interval, { weekStartsOn: 1 });
      break;
    case 'yearly':
      starts = eachYearOfInterval(interval);
      break;
    case 'monthly':
    default:
      starts = eachMonthOfInterval(interval);
      break;
  }

  return starts.map((bucketStart) => ({
    key: bucketKeyFor(bucketStart, period),
    startDate: bucketStart,
  }));
}

/**
 * How many buckets enumerateBuckets would produce, without building them, so a
 * range can be rejected before the work starts. Kept beside it: the two must
 * agree on every period, weekly included (ISO weeks, Monday-based).
 */
export function countBuckets(
  startDate: Date,
  endDate: Date,
  period: TrendPeriod,
): number {
  switch (period) {
    case 'daily':
      return differenceInCalendarDays(endDate, startDate) + 1;
    case 'weekly':
      return differenceInCalendarISOWeeks(endDate, startDate) + 1;
    case 'yearly':
      return differenceInCalendarYears(endDate, startDate) + 1;
    case 'monthly':
    default:
      return differenceInCalendarMonths(endDate, startDate) + 1;
  }
}
