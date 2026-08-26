import { describe, expect, it } from 'vitest';
import chatAggregationService from '@/server/services/chatAggregationService';
import {
  Transaction,
  TransactionSummary,
  TransactionType,
} from '@/shared/types/transaction';

const tx = (
  value: number,
  type: TransactionType = 'EXPENSE',
  categoryName = 'Food',
): Transaction => ({
  id: `t-${value}-${categoryName}`,
  description: 'Groceries',
  value,
  date: new Date('2024-03-15T12:00:00Z'),
  type,
  status: 'APPROVED',
  category: { id: 'c1', name: categoryName },
});

function totalsOf(
  overrides: Partial<TransactionSummary> = {},
): TransactionSummary {
  return {
    totalIncome: 0,
    totalExpense: 0,
    count: 0,
    incomeCount: 0,
    expenseCount: 0,
    ...overrides,
  };
}

describe('computeComparison', () => {
  it('renders both totals and the difference as plain ILS', () => {
    const { summary } = chatAggregationService.computeComparison(
      { label: 'January', totals: totalsOf({ totalExpense: 1000, count: 1 }) },
      {
        label: 'February',
        totals: totalsOf({ totalExpense: 1234.5, count: 1 }),
      },
    );

    expect(summary).toContain('January: 1,000.00 ₪ (1 transaction)');
    expect(summary).toContain('February: 1,234.50 ₪ (1 transaction)');
    expect(summary).toContain('Difference: +234.50 ₪ (February vs January)');
  });

  it('signs a decrease once, on the difference label', () => {
    const { summary } = chatAggregationService.computeComparison(
      { label: 'January', totals: totalsOf({ totalExpense: 500, count: 1 }) },
      { label: 'February', totals: totalsOf({ totalExpense: 200, count: 1 }) },
    );

    expect(summary).toContain('Difference: -300.00 ₪');
  });

  it('reports an undefined percentage rather than infinity', () => {
    const { summary } = chatAggregationService.computeComparison(
      { label: 'January', totals: totalsOf() },
      { label: 'February', totals: totalsOf({ totalExpense: 200, count: 1 }) },
    );

    expect(summary).toContain('Percentage change: not applicable');
  });
});

describe('aggregateFromTotals', () => {
  it('renders the total block as plain ILS', () => {
    const { summary } = chatAggregationService.aggregateFromTotals(
      totalsOf({
        totalIncome: 300,
        totalExpense: 120,
        count: 2,
        incomeCount: 1,
        expenseCount: 1,
      }),
      'total',
    );

    expect(summary).toBe(
      [
        'Total Income: 300.00 ₪',
        'Total Expenses: 120.00 ₪',
        'Net: 180.00 ₪',
      ].join('\n'),
    );
  });

  it('averages across income and expenses together', () => {
    const { summary } = chatAggregationService.aggregateFromTotals(
      totalsOf({
        totalIncome: 100,
        totalExpense: 100,
        count: 3,
        incomeCount: 1,
        expenseCount: 2,
      }),
      'average',
    );

    expect(summary).toContain('Average transaction value: 66.67 ₪');
    expect(summary).toContain('across 3 transactions, total: 200.00 ₪');
  });

  it('reports the empty average without dividing by zero', () => {
    const { summary } = chatAggregationService.aggregateFromTotals(
      totalsOf(),
      'average',
    );

    expect(summary).toBe('No transactions found to calculate an average.');
  });

  it('counts income and expenses separately', () => {
    const { summary } = chatAggregationService.aggregateFromTotals(
      totalsOf({ count: 3, incomeCount: 1, expenseCount: 2 }),
      'count',
    );

    expect(summary).toBe('Total transactions: 3 (1 income, 2 expenses)');
  });
});

describe('aggregate', () => {
  it('renders a category breakdown as plain ILS with shares', () => {
    const { summary } = chatAggregationService.aggregate(
      [tx(75, 'EXPENSE', 'Food'), tx(25, 'EXPENSE', 'Transport')],
      'breakdown_by_category',
    );

    expect(summary).toContain('Food: 75.00 ₪ (75%)');
    expect(summary).toContain('Transport: 25.00 ₪ (25%)');
    expect(summary).toContain('Total: 100.00 ₪');
  });

  it('emits no directionality marks for the model to quote back', () => {
    const { summary } = chatAggregationService.aggregate(
      [tx(1234.5)],
      'breakdown_by_category',
    );

    expect(summary).not.toMatch(/[\u200e\u200f\u00a0]/);
  });
});
