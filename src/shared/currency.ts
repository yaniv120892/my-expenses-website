import { z } from 'zod';

/** The currency every stored `value` and every total is in. */
export const BASE_CURRENCY = 'ILS';

// The currencies the Bank of Israel publishes a representative rate for, so
// these convert without a rate typed by hand.
export const RATE_PUBLISHED_CURRENCIES = [
  'USD',
  'EUR',
  'GBP',
  'CHF',
  'JPY',
  'CAD',
  'AUD',
  'SEK',
  'NOK',
  'DKK',
  'ZAR',
  'JOD',
  'EGP',
  'LBP',
] as const;

export const SELECTABLE_CURRENCIES: readonly string[] = [
  BASE_CURRENCY,
  ...RATE_PUBLISHED_CURRENCIES,
];

const KNOWN_CURRENCIES = new Set(Intl.supportedValuesOf('currency'));

export const currencyCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine((code) => KNOWN_CURRENCIES.has(code), {
    message: 'Must be an ISO 4217 currency code, such as ILS or USD',
  });

export function isForeignCurrency(currency: string | null): boolean {
  return currency !== null && currency !== BASE_CURRENCY;
}
