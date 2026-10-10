const PAYMENT_MONTH = /^(\d{1,2})\/(\d{4})$/;

export function comparePaymentMonths(
  a: string | null | undefined,
  b: string | null | undefined,
): number {
  return chronologicalKey(a).localeCompare(chronologicalKey(b));
}

// The month is free text on upload, so anything unparseable sorts with the
// missing months rather than as raw text among the YYYY-MM keys.
function chronologicalKey(paymentMonth: string | null | undefined): string {
  const match = PAYMENT_MONTH.exec(paymentMonth?.trim() ?? '');
  return match ? `${match[2]}-${match[1].padStart(2, '0')}` : '';
}
