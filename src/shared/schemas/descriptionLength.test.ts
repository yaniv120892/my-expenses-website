import { describe, expect, it } from 'vitest';
import type { ZodType } from 'zod';
import { DESCRIPTION_MAX_LENGTH } from '@/shared/descriptions';
import { createTransactionSchema, updateTransactionSchema } from './transactions';
import { approveImportedTransactionSchema, mergeImportedTransactionSchema } from './imports';
import { createScheduledTransactionSchema } from './scheduledTransactions';

const CATEGORY_ID = '00000000-0000-4000-8000-000000000000';
const transaction = { value: 30, type: 'EXPENSE', date: '2026-11-10', categoryId: CATEGORY_ID };
const schedule = {
  value: 8,
  type: 'EXPENSE',
  categoryId: CATEGORY_ID,
  scheduleType: 'MONTHLY',
  dayOfMonth: 2,
};

const schemas: [string, ZodType, Record<string, unknown>][] = [
  ['create transaction', createTransactionSchema, transaction],
  ['update transaction', updateTransactionSchema, transaction],
  ['approve imported row', approveImportedTransactionSchema, transaction],
  ['merge imported row', mergeImportedTransactionSchema, transaction],
  ['create schedule', createScheduledTransactionSchema, schedule],
];

describe.each(schemas)('%s description', (_name, schema, fields) => {
  it('accepts a description at the cap', () => {
    const description = 'a'.repeat(DESCRIPTION_MAX_LENGTH);

    expect(schema.safeParse({ ...fields, description }).success).toBe(true);
  });

  it('refuses a description over the cap, since it reaches a model prompt', () => {
    const description = 'a'.repeat(DESCRIPTION_MAX_LENGTH + 1);

    expect(schema.safeParse({ ...fields, description }).success).toBe(false);
  });
});
