import { describe, expect, it } from 'vitest';
import { TransactionType } from '@prisma/client';
import { selectNonDuplicateRows } from '@/server/repositories/importedTransactionRepository';

const row = (
  value: number,
  day: number,
  description = 'merchant',
  type: TransactionType = TransactionType.EXPENSE,
) => ({ value, date: new Date(2026, 6, day), description, type });

describe('selectNonDuplicateRows', () => {
  it('brings every row across when the import holds nothing', () => {
    const incoming = [row(50, 25), row(234, 25)];

    expect(selectNonDuplicateRows([], incoming)).toEqual(incoming);
  });

  it('drops a row the import already holds', () => {
    expect(selectNonDuplicateRows([row(50, 25)], [row(50, 25)])).toEqual([]);
  });

  // The extraction service truncates merchant names differently between runs,
  // so the same statement re-imported must still be recognised.
  it('drops a row whose description was spelled differently', () => {
    const existing = [row(50, 25, 'שלומי קריבי עיצוב שיער')];
    const incoming = [row(50, 25, 'שלומי קריבי עיצוב שיערגב')];

    expect(selectNonDuplicateRows(existing, incoming)).toEqual([]);
  });

  it('keeps a row whose value differs', () => {
    expect(selectNonDuplicateRows([row(50, 25)], [row(51, 25)])).toHaveLength(
      1,
    );
  });

  it('keeps a row whose date differs', () => {
    expect(selectNonDuplicateRows([row(50, 25)], [row(50, 26)])).toHaveLength(
      1,
    );
  });

  it('keeps a refund that mirrors a charge of the same amount and day', () => {
    const existing = [row(50, 25, 'merchant', TransactionType.EXPENSE)];
    const incoming = [row(50, 25, 'refund', TransactionType.INCOME)];

    expect(selectNonDuplicateRows(existing, incoming)).toEqual(incoming);
  });

  it('keeps a different merchant charging the same amount on the same day', () => {
    const existing = [row(50, 25, 'רמי לוי בן גוריון גבעתיים')];
    const incoming = [row(50, 25, 'קפה אין')];

    expect(selectNonDuplicateRows(existing, incoming)).toEqual(incoming);
  });

  // An absent description is no evidence of sameness, so it must not make one
  // row stand in for a different charge of the same amount that day.
  it('keeps a row when only one side has no usable description', () => {
    const existing = [row(50, 25, '---')];
    const incoming = [row(50, 25, 'רמי לוי')];

    expect(selectNonDuplicateRows(existing, incoming)).toEqual(incoming);
  });

  it('drops a row when neither side has a usable description', () => {
    const existing = [row(50, 25, '---')];
    const incoming = [row(50, 25, '***')];

    expect(selectNonDuplicateRows(existing, incoming)).toEqual([]);
  });

  it('consumes each existing row once, so a genuinely repeated charge survives', () => {
    const existing = [row(16, 22)];
    const incoming = [row(16, 22), row(16, 22)];

    expect(selectNonDuplicateRows(existing, incoming)).toHaveLength(1);
  });

  it('drops both when the import already holds the charge twice', () => {
    const existing = [row(16, 22), row(16, 22)];
    const incoming = [row(16, 22), row(16, 22)];

    expect(selectNonDuplicateRows(existing, incoming)).toEqual([]);
  });
});
