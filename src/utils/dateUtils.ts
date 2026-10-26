import { format, isValid, parseISO } from 'date-fns';

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

/** A cleared or partial date input yields null rather than an Invalid Date that `format` throws on. */
export function parseDayInput(value: string): Date | null {
  if (!value) {
    return null;
  }
  const date = parseISO(value);
  return isValid(date) ? date : null;
}
