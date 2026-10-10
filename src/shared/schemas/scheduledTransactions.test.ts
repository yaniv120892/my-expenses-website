import { describe, expect, it } from 'vitest';
import { createScheduledTransactionSchema } from './scheduledTransactions';

const monthly = {
  description: 'גוגל אחסון',
  value: 8,
  type: 'EXPENSE',
  categoryId: '00000000-0000-4000-8000-000000000000',
  scheduleType: 'MONTHLY',
  dayOfMonth: 2,
};

describe('createScheduledTransactionSchema bankDescriptionPrefix', () => {
  it('trims a prefix', () => {
    const parsed = createScheduledTransactionSchema.parse({
      ...monthly,
      bankDescriptionPrefix: '  GOOGLE ',
    });

    expect(parsed.bankDescriptionPrefix).toBe('GOOGLE');
  });

  it('reads a blank field as no prefix, so the form can clear it', () => {
    const parsed = createScheduledTransactionSchema.parse({
      ...monthly,
      bankDescriptionPrefix: '   ',
    });

    expect(parsed.bankDescriptionPrefix).toBeUndefined();
  });

  it('refuses a prefix too short to name a merchant', () => {
    expect(() =>
      createScheduledTransactionSchema.parse({
        ...monthly,
        bankDescriptionPrefix: 'GO',
      }),
    ).toThrow();
  });

  it('counts the prefix the way the matcher reads it, so punctuation does not pad it', () => {
    expect(() =>
      createScheduledTransactionSchema.parse({
        ...monthly,
        bankDescriptionPrefix: '**ab',
      }),
    ).toThrow();
  });
});
