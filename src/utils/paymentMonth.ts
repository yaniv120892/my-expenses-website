import { normalizePaymentMonth } from '@/shared/paymentMonth';

export function comparePaymentMonths(
  a: string | null | undefined,
  b: string | null | undefined,
): number {
  return chronologicalKey(a).localeCompare(chronologicalKey(b));
}

// Rows stored before months were normalized on write may still hold any text;
// those sort with the missing months rather than among the YYYY-MM keys.
function chronologicalKey(paymentMonth: string | null | undefined): string {
  const normalized = normalizePaymentMonth(paymentMonth ?? '');
  if (!normalized) {
    return '';
  }
  const [month, year] = normalized.split('/');
  return `${year}-${month}`;
}
