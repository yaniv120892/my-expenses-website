const PAYMENT_MONTH_INPUT = /^(\d{1,2})\/(\d{4})$/;

/**
 * The stored form is `MM/YYYY`: card + month is the duplicate-import key and
 * the filter groups on the exact string, so `3/2026` and `03/2026` must be one
 * value. Returns null for anything that does not name a month.
 */
export function normalizePaymentMonth(raw: string): string | null {
  const match = PAYMENT_MONTH_INPUT.exec(raw.trim());
  if (!match) {
    return null;
  }
  const [, month, year] = match;
  const monthNumber = Number(month);
  if (monthNumber < 1 || monthNumber > 12) {
    return null;
  }
  return `${month.padStart(2, '0')}/${year}`;
}
