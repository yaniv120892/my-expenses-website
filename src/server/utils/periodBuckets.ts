import {
  eachDayOfInterval,
  eachMonthOfInterval,
  eachWeekOfInterval,
  eachYearOfInterval,
  format,
} from 'date-fns';
import { TrendPeriod } from '@/shared/types/trends';

const DEFAULT_PERIOD_FORMAT = 'yyyy-MM-dd';
// Weekly uses ISO week-year + ISO week ('RRRR-II') so year-boundary weeks
// don't collide with week 1 of the same calendar year.
export const PERIOD_FORMATS: Record<string, string> = {
  daily: 'yyyy-MM-dd',
  weekly: 'RRRR-II',
  monthly: 'yyyy-MM',
  yearly: 'yyyy',
};

export function bucketKeyFor(date: Date, period: string): string {
  return format(date, PERIOD_FORMATS[period] ?? DEFAULT_PERIOD_FORMAT);
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
