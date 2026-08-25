import { format } from 'date-fns';

/** Wire format for a calendar day; date-fns patterns are case-sensitive — 'DD' is day-of-year. */
export const DAY_FORMAT = 'yyyy-MM-dd';

/** Wire format for a day with time, as datetime-local inputs produce. */
export const DAY_TIME_FORMAT = "yyyy-MM-dd'T'HH:mm:ss";

/** Wire format for a calendar month — period buckets and export filenames. */
export const MONTH_FORMAT = 'yyyy-MM';

export function toDayString(date: Date): string {
  return format(date, DAY_FORMAT);
}
