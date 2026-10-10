const PAYMENT_MONTH_INPUT = /^(0?[1-9]|1[0-2])\/(\d{4})$/;

type PaymentMonthParts = { month: string; year: string };

/** Stored as `MM/YYYY`, since card + month is compared as stored. */
export function normalizePaymentMonth(raw: string): string | null {
  const parts = parsePaymentMonth(raw);
  return parts ? `${parts.month}/${parts.year}` : null;
}

export function parsePaymentMonth(raw: string): PaymentMonthParts | null {
  const match = PAYMENT_MONTH_INPUT.exec(raw.trim());
  if (!match) {
    return null;
  }
  const [, month, year] = match;
  return { month: month.padStart(2, '0'), year };
}
