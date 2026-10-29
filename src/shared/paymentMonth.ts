const PAYMENT_MONTH_INPUT = /^(0?[1-9]|1[0-2])\/(\d{4})$/;

type PaymentMonthParts = { month: string; year: string };

/** Stored as `MM/YYYY`, since card + month is compared as stored. */
export function normalizePaymentMonth(raw: string): string | null {
  const parts = parsePaymentMonth(raw);
  return parts ? `${parts.month}/${parts.year}` : null;
}

export function parsePaymentMonth(raw: string): PaymentMonthParts | null {
  const [, month, year] = PAYMENT_MONTH_INPUT.exec(raw.trim()) ?? [];
  if (month === undefined || year === undefined) {
    return null;
  }
  return { month: month.padStart(2, '0'), year };
}
