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

  it('accepts the smallest storable amount', () => {
    expect(schema.safeParse(payload(0.01)).success).toBe(true);
  });

  it.each([0, -5, '', '   ', null, 0.004, 1e13, '1e3', true, [5]])(
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

describe('a form field sent as text', () => {
  const create = (fields: Record<string, unknown>) =>
    createTransactionSchema.safeParse({
      description: 'Coffee',
      type: 'EXPENSE',
      ...fields,
    });

  it('reads plain decimal text as the amount', () => {
    expect(create({ value: ' 12.50 ' }).data?.value).toBe(12.5);
  });

  it('keeps a rate under a cent, and refuses a blank or infinite one', () => {
    const foreign = { currency: 'JPY', originalAmount: 1000 };

    expect(create({ ...foreign, exchangeRate: '0.0254' }).success).toBe(true);
    expect(create({ ...foreign, exchangeRate: '' }).success).toBe(false);
    expect(create({ ...foreign, exchangeRate: 'Infinity' }).success).toBe(
      false,
    );
  });
});
