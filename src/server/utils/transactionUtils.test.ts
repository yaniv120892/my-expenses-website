import { describe, expect, it } from 'vitest';
import { formatTransaction } from '@/server/utils/transactionUtils';
import type { Transaction, TransactionType } from '@/shared/types/transaction';

const transactionOfType = (type: TransactionType): Transaction => ({
  id: 'tx-1',
  description: 'החזר CashPro',
  date: new Date('2026-10-31T00:00:00Z'),
  type,
  status: 'APPROVED',
  category: { id: 'cat-other-income', name: 'Other (Income)' },
  value: 27.69,
  currency: 'ILS',
  originalAmount: 27.69,
  exchangeRate: null,
  exchangeRateDate: null,
  exchangeRateSource: null,
});

describe('formatTransaction', () => {
  it('marks income as money received', () => {
    expect(formatTransaction(transactionOfType('INCOME'))).toBe(
      '📈 החזר CashPro - 27.69\n📂 Other (Income)  📅 2026-10-31',
    );
  });

  it('marks an expense as money spent', () => {
    expect(formatTransaction(transactionOfType('EXPENSE'))).toMatch(/^📉 /);
  });
});
