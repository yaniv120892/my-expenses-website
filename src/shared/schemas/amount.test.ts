import { describe, expect, it } from 'vitest';
import {
  createTransactionSchema,
  updateTransactionSchema,
} from './transactions';
import {
  approveImportedTransactionSchema,
  mergeImportedTransactionSchema,
} from './imports';
import { createScheduledTransactionSchema } from './scheduledTransactions';
import { updateSubscriptionSchema } from './subscriptions';
import { POSITIVE_AMOUNT_MESSAGE } from './amount';

const CATEGORY_ID = '00000000-0000-4000-8000-000000000000';
const DATE = '2026-10-01';

const amountFields = [
  {
    name: 'create transaction value',
    schema: createTransactionSchema,
    payload: (amount: unknown) => ({
      description: 'Coffee',
      type: 'EXPENSE',
      value: amount,
    }),
  },
  {
    name: 'create transaction originalAmount',
    schema: createTransactionSchema,
    payload: (amount: unknown) => ({
      description: 'Coffee',
      type: 'EXPENSE',
      currency: 'USD',
      originalAmount: amount,
    }),
  },
  {
    name: 'update transaction value',
    schema: updateTransactionSchema,
    payload: (amount: unknown) => ({
      description: 'Coffee',
      type: 'EXPENSE',
      categoryId: CATEGORY_ID,
      date: DATE,
      value: amount,
    }),
  },
  {
    name: 'scheduled transaction value',
    schema: createScheduledTransactionSchema,
    payload: (amount: unknown) => ({
      description: 'Rent',
      type: 'EXPENSE',
      categoryId: CATEGORY_ID,
      scheduleType: 'MONTHLY',
      dayOfMonth: 1,
      value: amount,
    }),
  },
  {
    name: 'approve imported row value',
    schema: approveImportedTransactionSchema,
    payload: (amount: unknown) => ({
      description: 'Coffee',
      type: 'EXPENSE',
      date: DATE,
      value: amount,
    }),
  },
  {
    name: 'merge imported row value',
    schema: mergeImportedTransactionSchema,
    payload: (amount: unknown) => ({
      description: 'Coffee',
      type: 'EXPENSE',
      categoryId: CATEGORY_ID,
      date: DATE,
      value: amount,
    }),
  },
  {
    name: 'subscription averageAmount',
    schema: updateSubscriptionSchema,
    payload: (amount: unknown) => ({ averageAmount: amount }),
  },
];

describe.each(amountFields)('$name', ({ schema, payload }) => {
  it('accepts a positive amount', () => {
    expect(schema.safeParse(payload(12.5)).success).toBe(true);
  });

  it.each([0, -5, '', '   ', null])(
    'refuses %j with the amount message',
    (amount) => {
      const result = schema.safeParse(payload(amount));

      expect(result.success).toBe(false);
      expect(result.error?.issues.map((issue) => issue.message)).toContain(
        POSITIVE_AMOUNT_MESSAGE,
      );
    },
  );
});
