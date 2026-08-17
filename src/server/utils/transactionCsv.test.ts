import { describe, expect, it } from 'vitest';
import {
  buildTransactionsCsv,
  transactionsCsvFileName,
} from '@/server/utils/transactionCsv';
import { Transaction } from '@/shared/types/transaction';

const transaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 'id-1',
  description: 'Coffee',
  value: 12.5,
  date: new Date('2026-08-14T09:30:00.000Z'),
  type: 'EXPENSE',
  status: 'APPROVED',
  category: { id: 'cat-1', name: 'Food' },
  ...overrides,
});

describe('buildTransactionsCsv', () => {
  it('emits the five-column header and one row per transaction', () => {
    const lines = buildTransactionsCsv([
      transaction(),
      transaction({ id: 'id-2', description: 'Salary', type: 'INCOME' }),
    ]).split('\n');

    expect(lines[0]).toBe('"date","description","value","type","categoryName"');
    expect(lines).toHaveLength(3);
  });

  it('formats the date as yyyy-MM-dd', () => {
    const lines = buildTransactionsCsv([transaction()]).split('\n');

    expect(lines[1]).toContain('"2026-08-14"');
    expect(lines[1]).not.toContain('T09:30');
  });

  it('renders a missing category as an empty string', () => {
    const withoutCategory = transaction({
      category: undefined as unknown as Transaction['category'],
    });

    expect(buildTransactionsCsv([withoutCategory]).split('\n')[1]).toContain(
      '""',
    );
  });

  it('escapes quotes in a description', () => {
    const lines = buildTransactionsCsv([
      transaction({ description: 'Coffee, "large"' }),
    ]).split('\n');

    expect(lines[1]).toContain('"Coffee, ""large"""');
  });

  it('returns a header-only file for no transactions', () => {
    expect(buildTransactionsCsv([])).toBe(
      '"date","description","value","type","categoryName"',
    );
  });
});

describe('transactionsCsvFileName', () => {
  const now = new Date('2026-08-17T00:00:00.000Z');

  it('names the file after the range when both bounds are set', () => {
    const fileName = transactionsCsvFileName(
      {
        startDate: new Date('2026-08-01T00:00:00.000Z'),
        endDate: new Date('2026-08-31T00:00:00.000Z'),
      },
      now,
    );

    expect(fileName).toBe('transactions_2026-08-01_2026-08-31.csv');
  });

  it('falls back to today when a bound is missing', () => {
    expect(
      transactionsCsvFileName({ endDate: new Date('2026-08-31') }, now),
    ).toBe('transactions_2026-08-17.csv');
    expect(
      transactionsCsvFileName({ startDate: new Date('2026-08-01') }, now),
    ).toBe('transactions_2026-08-17.csv');
    expect(transactionsCsvFileName({}, now)).toBe(
      'transactions_2026-08-17.csv',
    );
  });
});
