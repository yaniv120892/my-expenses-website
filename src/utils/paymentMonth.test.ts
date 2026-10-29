import { describe, expect, it } from 'vitest';
import { comparePaymentMonths } from '@/utils/paymentMonth';

describe('comparePaymentMonths', () => {
  it('orders by year before month', () => {
    expect(['02/2026', '12/2025', '01/2026', '11/2025'].sort(comparePaymentMonths)).toEqual([
      '11/2025',
      '12/2025',
      '01/2026',
      '02/2026',
    ]);
  });

  it('reads a single-digit month and surrounding spaces', () => {
    expect(['04/2026', ' 03/2026 ', '3/2025', '12/2025'].sort(comparePaymentMonths)).toEqual([
      '3/2025',
      '12/2025',
      ' 03/2026 ',
      '04/2026',
    ]);
  });

  it('sorts a missing or unreadable month first', () => {
    expect(['01/2026', 'March', null, '03/26'].sort(comparePaymentMonths)).toEqual([
      'March',
      null,
      '03/26',
      '01/2026',
    ]);
  });
});
