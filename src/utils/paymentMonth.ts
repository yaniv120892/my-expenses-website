import { parsePaymentMonth } from '@/shared/paymentMonth';

export function comparePaymentMonths(
  a: string | null | undefined,
  b: string | null | undefined,
): number {
  return chronologicalKey(a).localeCompare(chronologicalKey(b));
}

export function isUnreadablePaymentMonth(raw: string): boolean {
  return raw.trim() !== '' && parsePaymentMonth(raw) === null;
}

// Rows stored before months were normalized on write may still hold any text;
// those sort with the missing months rather than among the YYYY-MM keys.
function chronologicalKey(paymentMonth: string | null | undefined): string {
  const parts = parsePaymentMonth(paymentMonth ?? '');
  return parts ? `${parts.year}-${parts.month}` : '';
}
