import {
  endOfMonth,
  endOfYear,
  format,
  parseISO,
  startOfMonth,
  startOfYear,
  subMonths,
} from 'date-fns';

export type DateRangePresetId =
  'this-month' | 'last-month' | 'last-3-months' | 'this-year' | 'all-time';

export interface DateRange {
  startDate?: string;
  endDate?: string;
}

export interface DateRangePreset {
  id: DateRangePresetId;
  label: string;
  /** `now` is passed in rather than read, so the ranges are testable. */
  range: (now: Date) => DateRange;
}

const asDay = (value: Date) => format(value, 'yyyy-MM-dd');

export const DATE_RANGE_PRESETS: DateRangePreset[] = [
  {
    id: 'this-month',
    label: 'This month',
    range: (now) => ({
      startDate: asDay(startOfMonth(now)),
      endDate: asDay(endOfMonth(now)),
    }),
  },
  {
    id: 'last-month',
    label: 'Last month',
    range: (now) => ({
      startDate: asDay(startOfMonth(subMonths(now, 1))),
      endDate: asDay(endOfMonth(subMonths(now, 1))),
    }),
  },
  {
    id: 'last-3-months',
    label: 'Last 3 months',
    range: (now) => ({
      startDate: asDay(startOfMonth(subMonths(now, 2))),
      endDate: asDay(endOfMonth(now)),
    }),
  },
  {
    id: 'this-year',
    label: 'This year',
    range: (now) => ({
      startDate: asDay(startOfYear(now)),
      endDate: asDay(endOfYear(now)),
    }),
  },
  { id: 'all-time', label: 'All time', range: () => ({}) },
];

/**
 * Which preset a range corresponds to, so the chips can show the current
 * selection instead of only setting it. An unbounded range is 'all-time'; a
 * hand-typed range that matches no preset is undefined.
 */
export function matchDateRangePreset(
  range: DateRange,
  now: Date,
): DateRangePresetId | undefined {
  return DATE_RANGE_PRESETS.find((preset) => {
    const { startDate, endDate } = preset.range(now);
    return startDate === range.startDate && endDate === range.endDate;
  })?.id;
}

/** The range this month covers, which is what the transactions page opens on. */
export function defaultDateRange(now: Date = new Date()): DateRange {
  return DATE_RANGE_PRESETS[0].range(now);
}

/**
 * A label for the range a page is showing. A whole calendar month or year is
 * named rather than spelled out as two dates, because that is how a reader
 * thinks about it — and it is the common case, every preset but one.
 *
 * Date-only strings are parsed as local time: `new Date('2026-07-01')` is UTC
 * midnight, which lands on the previous day west of Greenwich.
 */
export function describeDateRange(range: DateRange): string {
  const { startDate, endDate } = range;
  if (!startDate && !endDate) return 'All time';
  if (!startDate) return `Until ${formatDay(endDate as string)}`;
  if (!endDate) return `From ${formatDay(startDate)}`;

  // Both bounds are checked against the period containing `start`, so a range
  // whose end lands in a different month falls through to the spelled-out form.
  const start = parseISO(startDate);

  if (
    startDate === asDay(startOfYear(start)) &&
    endDate === asDay(endOfYear(start))
  ) {
    return format(start, 'yyyy');
  }
  if (
    startDate === asDay(startOfMonth(start)) &&
    endDate === asDay(endOfMonth(start))
  ) {
    return format(start, 'MMMM yyyy');
  }
  return `${formatDay(startDate)} – ${formatDay(endDate)}`;
}

function formatDay(day: string): string {
  return format(parseISO(day), 'MMM d, yyyy');
}
