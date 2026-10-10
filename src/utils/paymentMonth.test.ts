import { describe, expect, it } from 'vitest';
import { comparePaymentMonths } from '@/utils/paymentMonth';

describe('comparePaymentMonths', () => {
  it('orders by year before month', () => {
    expect(
      ['02/2026', '12/2025', '01/2026', '11/2025'].sort(comparePaymentMonths),
    ).toEqual(['11/2025', '12/2025', '01/2026', '02/2026']);
  });

  it('sorts a missing month first', () => {
    expect(['01/2026', null].sort(comparePaymentMonths)).toEqual([
      null,
      '01/2026',
    ]);
  });
});
