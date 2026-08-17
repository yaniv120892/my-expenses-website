import { describe, expect, it } from 'vitest';
import chatAggregationService from '@/server/services/chatAggregationService';
import { Transaction, TransactionType } from '@/shared/types/transaction';

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

describe('computeComparison', () => {
  it('renders both totals and the difference as plain ILS', () => {
    const { summary } = chatAggregationService.computeComparison(
      { label: 'January', transactions: [tx(1000)] },
      { label: 'February', transactions: [tx(1234.5)] },
    );

    expect(summary).toContain('January: 1,000.00 ₪ (1 transaction)');
    expect(summary).toContain('February: 1,234.50 ₪ (1 transaction)');
    expect(summary).toContain('Difference: +234.50 ₪ (February vs January)');
  });

  it('signs a decrease once, on the difference label', () => {
    const { summary } = chatAggregationService.computeComparison(
      { label: 'January', transactions: [tx(500)] },
      { label: 'February', transactions: [tx(200)] },
    );

    expect(summary).toContain('Difference: -300.00 ₪');
  });

  it('reports an undefined percentage rather than infinity', () => {
    const { summary } = chatAggregationService.computeComparison(
      { label: 'January', transactions: [] },
      { label: 'February', transactions: [tx(200)] },
    );

    expect(summary).toContain('Percentage change: not applicable');
  });
});

describe('aggregate', () => {
  it('renders the total block as plain ILS', () => {
    const { summary } = chatAggregationService.aggregate(
      [tx(300, 'INCOME'), tx(120)],
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
    const { summary } = chatAggregationService.aggregate([tx(1234.5)], 'total');

    expect(summary).not.toMatch(/[\u200e\u200f\u00a0]/);
  });
});
