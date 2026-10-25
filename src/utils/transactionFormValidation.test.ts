import { describe, it, expect } from 'vitest';
import {
  validateTransactionForm,
  TransactionFormValues,
} from './transactionFormValidation';
import {
  createTransactionSchema,
  updateTransactionSchema,
} from '@/shared/schemas/transactions';
import {
  approveImportedTransactionSchema,
  mergeImportedTransactionSchema,
} from '@/shared/schemas/imports';

const CATEGORY_ID = '11111111-1111-4111-8111-111111111111';

function form(
  overrides: Partial<TransactionFormValues> = {},
): TransactionFormValues {
  return {
    description: 'Coffee',
    value: 12,
    categoryId: CATEGORY_ID,
    type: 'EXPENSE',
    date: '2026-08-01',
    ...overrides,
  };
}

/** What TransactionForm.handleSubmit builds from the form state. */
function submitPayload(values: TransactionFormValues) {
  return {
    ...values,
    value: Number(values.value),
    categoryId: values.categoryId === '' ? undefined : values.categoryId,
  };
}

describe('validateTransactionForm', () => {
  it('accepts a complete form in both modes', () => {
    expect(validateTransactionForm(form(), false)).toEqual({});
    expect(validateTransactionForm(form(), true)).toEqual({});
  });

  it('reports the usual required fields', () => {
    const errors = validateTransactionForm(
      form({ description: '', value: 0, type: '', date: '' }),
      false,
    );
    expect(Object.keys(errors).sort()).toEqual([
      'date',
      'description',
      'type',
      'value',
    ]);
  });

  it('rejects a non-numeric value', () => {
    expect(validateTransactionForm(form({ value: 'abc' }), false).value).toBe(
      'Value must be a number',
    );
  });

  it('holds the value to the server amount bounds', () => {
    const valueError = (value: number | string) =>
      validateTransactionForm(form({ value }), false).value;

    expect(valueError(0.004)).toBe('Value must be greater than 0');
    expect(valueError(10_000_001)).toBe('Value must be greater than 0');
    expect(valueError('')).toBe('Value must be greater than 0');
    expect(valueError(0.01)).toBeUndefined();
    expect(valueError('.5')).toBeUndefined();
    expect(valueError(10_000_000)).toBeUndefined();
  });

  it('holds the amount charged to the same bounds', () => {
    const baseValueError = (baseValue: number | string) =>
      validateTransactionForm(form({ baseValue }), false).baseValue;

    expect(baseValueError(0.004)).toBeDefined();
    expect(baseValueError(0)).toBeDefined();
    expect(baseValueError('')).toBeUndefined();
    expect(baseValueError(42.5)).toBeUndefined();
  });

  it('requires a category only when the target endpoint does', () => {
    const cleared = form({ categoryId: '' });

    expect(validateTransactionForm(cleared, false).categoryId).toBeUndefined();
    expect(validateTransactionForm(cleared, true).categoryId).toBe(
      'Category is required',
    );
  });

  it('lets an uncategorized import through the approve schema', () => {
    const cleared = submitPayload(form({ categoryId: '' }));

    expect(approveImportedTransactionSchema.safeParse(cleared).success).toBe(
      true,
    );
    expect(mergeImportedTransactionSchema.safeParse(cleared).success).toBe(
      false,
    );
  });

  it('only lets through payloads the matching API schema accepts', () => {
    const cleared = submitPayload(form({ categoryId: '' }));
    const filled = submitPayload(form());

    // Create tolerates the missing category; update does not, which is why
    // the form blocks it before the request goes out.
    expect(createTransactionSchema.safeParse(cleared).success).toBe(true);
    expect(updateTransactionSchema.safeParse(cleared).success).toBe(false);
    expect(updateTransactionSchema.safeParse(filled).success).toBe(true);
  });
});
