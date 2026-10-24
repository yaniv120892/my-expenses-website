import { format, isMatch } from 'date-fns';

/** date-fns patterns are case-sensitive — 'DD' is day-of-year. */
export const DAY_FORMAT = 'yyyy-MM-dd';

/** As datetime-local inputs produce. */
export const DAY_TIME_FORMAT = "yyyy-MM-dd'T'HH:mm:ss";

export const MONTH_FORMAT = 'yyyy-MM';

export function toDayString(date: Date): string {
  return format(date, DAY_FORMAT);
}

/**
 * The calendar day a stored date carries in its UTC fields — a transaction's
 * wall-clock time (see `toAppWallClock`) or a run date's midnight UTC.
 * `toDayString` reads local time, so off UTC it can name the neighbouring day.
 */
export function toUtcDayString(date: Date): string {
  return toDayString(
    new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isCalendarDay(value: string): boolean {
  return DAY_PATTERN.test(value) && isMatch(value, DAY_FORMAT);
}

export const APP_TIME_ZONE = 'Asia/Jerusalem';

const APP_WALL_CLOCK = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
  hourCycle: 'h23',
});

/**
 * The app's wall-clock time at `instant`, carried in the Date's UTC fields.
 * A transaction's date is stored that way: the form sends a local time with
 * no offset and the server reads it as UTC.
 */
export function toAppWallClock(instant: Date): Date {
  const parts = APP_WALL_CLOCK.formatToParts(instant);
  const field = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return new Date(
    Date.UTC(
      field('year'),
      field('month') - 1,
      field('day'),
      field('hour'),
      field('minute'),
      field('second'),
    ),
  );
}
