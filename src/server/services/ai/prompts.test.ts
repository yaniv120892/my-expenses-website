import { describe, expect, it } from 'vitest';
import { resolveMatchedTransactionId } from '@/server/services/ai/prompts';
import { Transaction } from '@/shared/types/transaction';

const match = (id: string): Transaction => ({
  id,
  description: 'Coffee',
  value: 10,
  date: new Date('2026-03-07T00:00:00Z'),
  type: 'EXPENSE',
  status: 'APPROVED',
  category: { id: 'c1', name: 'Food' },
});

describe('resolveMatchedTransactionId', () => {
  const candidates = [match('tx-a'), match('tx-b')];

  it('returns an id that names one of the offered matches', () => {
    expect(resolveMatchedTransactionId(' tx-b ', candidates)).toBe('tx-b');
  });

  it('rejects an id the model invented', () => {
    expect(
      resolveMatchedTransactionId(
        '99999999-9999-4999-8999-999999999999',
        candidates,
      ),
    ).toBeNull();
  });

  it.each([['none'], [''], [null], [undefined]])(
    'treats %s as no match',
    (answer) => {
      expect(resolveMatchedTransactionId(answer, candidates)).toBeNull();
    },
  );
});
