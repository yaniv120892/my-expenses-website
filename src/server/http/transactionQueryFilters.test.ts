import { describe, expect, it } from 'vitest';
import { toTransactionFilters } from '@/server/http/transactionQueryFilters';

describe('toTransactionFilters', () => {
  // Regression: the summary route spread `type` straight through, so the
  // service read an undefined `transactionType` and the totals covered every
  // type while the list below them was filtered.
  it('renames type to transactionType', () => {
    const filters = toTransactionFilters({ type: 'EXPENSE' }, 'user-1');

    expect(filters.transactionType).toBe('EXPENSE');
    expect('type' in filters).toBe(false);
  });

  it('attaches the userId', () => {
    expect(toTransactionFilters({}, 'user-1').userId).toBe('user-1');
  });

  it('leaves transactionType undefined when no type is filtered', () => {
    expect(toTransactionFilters({}, 'user-1').transactionType).toBeUndefined();
  });

  it('passes the remaining filters through untouched', () => {
    const startDate = new Date('2026-08-01');
    const endDate = new Date('2026-08-31');

    expect(
      toTransactionFilters(
        {
          startDate,
          endDate,
          categoryId: 'cat-1',
          searchTerm: 'coffee',
          cursor: 'abc',
          limit: 50,
        },
        'user-1',
      ),
    ).toEqual({
      startDate,
      endDate,
      categoryId: 'cat-1',
      searchTerm: 'coffee',
      cursor: 'abc',
      limit: 50,
      transactionType: undefined,
      userId: 'user-1',
    });
  });
});
