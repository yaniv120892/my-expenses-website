import { intlLocale, type Locale } from '@yaniv120892/my-ui';
import { BASE_CURRENCY } from '@/shared/currency';
import type { Format } from './useAppFormat.types';

/**
 * The shared `useFormat()` with each Intl formatter kept per locale and
 * options: that one builds a new formatter per call, and a table or chart
 * formats hundreds of values a render.
 */
export function cachedFormat(locale: Locale): Format {
  const languageTag = intlLocale(locale);
  return {
    number: (value, options) =>
      numberFormat({ languageTag, options }).format(value),
    currency: ({ value, currency = BASE_CURRENCY, options }) =>
      numberFormat({
        languageTag,
        options: { style: 'currency', currency, ...options },
      }).format(value),
    percent: (value, options) =>
      numberFormat({
        languageTag,
        options: { style: 'percent', maximumFractionDigits: 1, ...options },
      }).format(value),
    date: (value, options) =>
      dateFormat({
        languageTag,
        options: options ?? { dateStyle: 'medium' },
      }).format(new Date(value)),
  };
}

const numberFormats = new Map<string, Intl.NumberFormat>();
const dateFormats = new Map<string, Intl.DateTimeFormat>();

function numberFormat({
  languageTag,
  options,
}: {
  languageTag: string;
  options?: Intl.NumberFormatOptions;
}): Intl.NumberFormat {
  const key = `${languageTag}|${JSON.stringify(options)}`;
  let formatter = numberFormats.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(languageTag, options);
    numberFormats.set(key, formatter);
  }
  return formatter;
}

function dateFormat({
  languageTag,
  options,
}: {
  languageTag: string;
  options: Intl.DateTimeFormatOptions;
}): Intl.DateTimeFormat {
  const key = `${languageTag}|${JSON.stringify(options)}`;
  let formatter = dateFormats.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(languageTag, options);
    dateFormats.set(key, formatter);
  }
  return formatter;
}
