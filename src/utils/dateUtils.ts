import { format, isValid, parseISO } from 'date-fns';
import { TrendPeriod } from '@/types/trends';

export function formatTrendDate(date: string, period: TrendPeriod): string {
  switch (period) {
    case 'weekly':
      return `Week ${date.split('-')[1]}`;
    case 'monthly':
      return format(new Date(date + '-01'), 'MMM yyyy');
    case 'yearly':
      return date;
    default:
      return date;
  }
}

export const formatDate = (
  dateString: string,
  includeTime: boolean = false,
) => {
  const date = new Date(dateString);
  if (includeTime) {
    return format(date, 'dd/MM/yyyy HH:mm');
  }
  return date.toLocaleDateString();
};

/** parseISO, not `new Date`: the latter reads a date-only string as UTC midnight. */
export function formatDay(value: string | Date): string {
  return format(
    typeof value === 'string' ? parseISO(value) : value,
    'MMM d, yyyy',
  );
}

/** A cleared or partial date input yields null rather than an Invalid Date that `format` throws on. */
export function parseDayInput(value: string): Date | null {
  if (!value) {
    return null;
  }
  const date = parseISO(value);
  return isValid(date) ? date : null;
}

/** Renders "MMM d, yyyy - MMM d, yyyy"; a missing bound leaves its side blank. */
export function formatDateRange(
  start?: string | Date,
  end?: string | Date,
  separator: string = '-',
): string {
  const startLabel = start ? formatDay(start) : '';
  const endLabel = end ? formatDay(end) : '';
  return `${startLabel} ${separator} ${endLabel}`;
}
