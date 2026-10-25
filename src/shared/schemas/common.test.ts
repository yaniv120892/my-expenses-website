import { describe, expect, it } from 'vitest';
import { recordIdSchema } from './common';
import {
  createTransactionSchema,
  getTransactionsSchema,
  updateTransactionSchema,
} from './transactions';
import { createScheduledTransactionSchema } from './scheduledTransactions';
import {
  convertSubscriptionSchema,
  updateSubscriptionSchema,
} from './subscriptions';
import { getCategoryComparisonQuerySchema } from './trends';

// Seeded by migration 20250512053843_add_categories; its version nibble is 6
// and its variant nibble 3, so an RFC 9562 check refuses it.
const SEEDED_CATEGORY_ID = 'a6b7c8d9-6e7f-8a9b-3c4d-4e5f6a7b8c9d';

describe('recordIdSchema', () => {
  it('accepts an id the category migration seeded', () => {
    expect(recordIdSchema.parse(SEEDED_CATEGORY_ID)).toBe(SEEDED_CATEGORY_ID);
  });

  it('rejects a value not shaped like a uuid', () => {
    const result = recordIdSchema.safeParse('not-a-uuid');

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Invalid uuid');
  });

  it.each([
    [
      'createTransactionSchema',
      () =>
        createTransactionSchema.parse({
          description: 'x',
          value: 1,
          type: 'EXPENSE',
          categoryId: SEEDED_CATEGORY_ID,
        }).categoryId,
    ],
    [
      'updateTransactionSchema',
      () =>
        updateTransactionSchema.parse({
          description: 'x',
          value: 1,
          type: 'EXPENSE',
          categoryId: SEEDED_CATEGORY_ID,
          date: '2026-01-01',
        }).categoryId,
    ],
    [
      'getTransactionsSchema',
      () =>
        getTransactionsSchema.parse({ categoryId: SEEDED_CATEGORY_ID })
          .categoryId,
    ],
    [
      'createScheduledTransactionSchema',
      () =>
        createScheduledTransactionSchema.parse({
          description: 'x',
          value: 1,
          type: 'EXPENSE',
          categoryId: SEEDED_CATEGORY_ID,
          scheduleType: 'MONTHLY',
          dayOfMonth: 2,
        }).categoryId,
    ],
    [
      'convertSubscriptionSchema',
      () =>
        convertSubscriptionSchema.parse({ categoryId: SEEDED_CATEGORY_ID })
          .categoryId,
    ],
    [
      'updateSubscriptionSchema',
      () =>
        updateSubscriptionSchema.parse({ categoryId: SEEDED_CATEGORY_ID })
          .categoryId,
    ],
    [
      'getCategoryComparisonQuerySchema',
      () =>
        getCategoryComparisonQuerySchema.parse({
          startDate: '2026-01-01',
          endDate: '2026-03-31',
          categoryIds: SEEDED_CATEGORY_ID,
        }).categoryIds[0],
    ],
  ])('%s takes a seeded category id', (_name, parseCategoryId) => {
    expect(parseCategoryId()).toBe(SEEDED_CATEGORY_ID);
  });
});
