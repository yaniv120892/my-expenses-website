import { isValid, parseISO } from 'date-fns';

/** A cleared or partial date input yields null rather than an Invalid Date that `format` throws on. */
export function parseDayInput(value: string): Date | null {
  if (!value) {
    return null;
  }
  const date = parseISO(value);
  return isValid(date) ? date : null;
}
