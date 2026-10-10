const PAYMENT_MONTH = /^(\d{2})\/(\d{4})$/;

function chronologicalKey(paymentMonth: string | null | undefined): string {
  if (!paymentMonth) {
    return '';
  }
  const match = PAYMENT_MONTH.exec(paymentMonth);
  return match ? `${match[2]}-${match[1]}` : paymentMonth;
}

export function comparePaymentMonths(
  a: string | null | undefined,
  b: string | null | undefined,
): number {
  return chronologicalKey(a).localeCompare(chronologicalKey(b));
}
