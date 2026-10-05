import { format } from 'date-fns';

/** date-fns patterns are case-sensitive — 'DD' is day-of-year. */
export const DAY_FORMAT = 'yyyy-MM-dd';

/** As datetime-local inputs produce. */
export const DAY_TIME_FORMAT = "yyyy-MM-dd'T'HH:mm:ss";

export const MONTH_FORMAT = 'yyyy-MM';

export function toDayString(date: Date): string {
  return format(date, DAY_FORMAT);
}
