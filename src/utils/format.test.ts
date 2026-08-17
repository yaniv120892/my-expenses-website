import { describe, expect, it } from 'vitest';
import {
  formatCurrency,
  formatCurrencyRounded,
  formatNumber,
  formatTransaction,
  formatTransactionDate,
  translateToScheduleSummary,
} from '@/utils/format';
import { Transaction } from '@/types';

const normalizeCurrency = (value: string) =>
  value.replace(/[‎‏]/g, '').replace(/ /g, ' ');

const makeTransaction = (overrides: Partial<Transaction> = {}): Transaction =>
  ({
    id: 't1',
    description: 'Groceries',
    value: 120,
    date: '2024-03-15T12:00:00',
    type: 'EXPENSE',
    category: { id: 'c1', name: 'Food' },
    ...overrides,
  }) as Transaction;

describe('formatTransactionDate', () => {
  it('renders yyyy-MM-dd', () => {
    expect(formatTransactionDate('2024-03-15T12:00:00')).toBe('2024-03-15');
  });

  it('zero-pads single-digit months and days', () => {
    expect(formatTransactionDate('2024-01-05T00:00:00')).toBe('2024-01-05');
  });
});

describe('formatTransaction', () => {
  it('combines description, category and date', () => {
    expect(formatTransaction(makeTransaction())).toBe(
      'Groceries - (Food) on 2024-03-15',
    );
  });

  it('falls back to N/A without a category', () => {
    const transaction = makeTransaction({
      category: undefined as unknown as Transaction['category'],
    });
    expect(formatTransaction(transaction)).toBe(
      'Groceries - (N/A) on 2024-03-15',
    );
  });
});

describe('formatNumber', () => {
  it('adds thousands separators', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
  });

  it('leaves small numbers untouched', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(999)).toBe('999');
  });
});

describe('formatCurrency', () => {
  it('formats as ILS with two decimals', () => {
    expect(normalizeCurrency(formatCurrency(1234.5))).toBe('1,234.50 ₪');
  });

  it('formats zero and negatives', () => {
    expect(normalizeCurrency(formatCurrency(0))).toBe('0.00 ₪');
    expect(normalizeCurrency(formatCurrency(-99))).toBe('-99.00 ₪');
  });
});

describe('formatCurrencyRounded', () => {
  it('drops the decimals and keeps thousands separators', () => {
    expect(normalizeCurrency(formatCurrencyRounded(1234.56))).toBe('1,235 ₪');
    expect(normalizeCurrency(formatCurrencyRounded(14814.72))).toBe('14,815 ₪');
  });

  it('formats zero and negatives', () => {
    expect(normalizeCurrency(formatCurrencyRounded(0))).toBe('0 ₪');
    expect(normalizeCurrency(formatCurrencyRounded(-99.4))).toBe('-99 ₪');
  });
});

describe('translateToScheduleSummary', () => {
  it('describes daily schedules with and without an interval', () => {
    expect(
      translateToScheduleSummary('DAILY', undefined, undefined, undefined),
    ).toBe('Runs every day.');
    expect(translateToScheduleSummary('DAILY', 1, undefined, undefined)).toBe(
      'Runs every day.',
    );
    expect(translateToScheduleSummary('DAILY', 3, undefined, undefined)).toBe(
      'Runs every 3 days.',
    );
  });

  it('describes weekly schedules using a 1-based day of week', () => {
    expect(translateToScheduleSummary('WEEKLY', undefined, 1, undefined)).toBe(
      'Runs every week on Sunday.',
    );
    expect(translateToScheduleSummary('WEEKLY', 2, 7, undefined)).toBe(
      'Runs every 2 weeks on Saturday.',
    );
  });

  it('prompts for a day of week when it is missing or zero', () => {
    expect(translateToScheduleSummary('WEEKLY', 1, undefined, undefined)).toBe(
      'Choose a day of week.',
    );
    expect(translateToScheduleSummary('WEEKLY', 1, 0, undefined)).toBe(
      'Choose a day of week.',
    );
  });

  it('describes monthly schedules and prompts without a day of month', () => {
    expect(
      translateToScheduleSummary('MONTHLY', undefined, undefined, 15),
    ).toBe('Runs every month on day 15.');
    expect(translateToScheduleSummary('MONTHLY', 6, undefined, 31)).toBe(
      'Runs every 6 months on day 31.',
    );
    expect(translateToScheduleSummary('MONTHLY', 1, undefined, undefined)).toBe(
      'Choose a day of month.',
    );
  });
});
