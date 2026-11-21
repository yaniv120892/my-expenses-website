import type { ImportedChargeToMatch } from '@/server/services/ai/aiProvider';
import type { Transaction } from '@/shared/types/transaction';

export const matchCandidate: Transaction = {
  id: 'tx-a',
  description: 'Coffee',
  value: 10,
  currency: 'ILS',
  originalAmount: 10,
  exchangeRate: null,
  exchangeRateDate: null,
  exchangeRateSource: null,
  date: new Date('2026-03-07T00:00:00Z'),
  type: 'EXPENSE',
  status: 'APPROVED',
  category: { id: 'cat-food', name: 'Food' },
};

export const importedCharge: ImportedChargeToMatch = {
  description: 'Coffee',
  value: 10,
  currency: 'ILS',
  originalAmount: 10,
  date: new Date('2026-03-07T00:00:00Z'),
  type: 'EXPENSE',
};
