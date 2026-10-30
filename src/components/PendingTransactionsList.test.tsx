// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import { renderWithClient } from '@/test/renderWithClient';
import PendingTransactionsList from '@/components/PendingTransactionsList';
import type { Transaction } from '@/types';

afterEach(cleanup);

function projectedBySchedule(): Transaction {
  return {
    id: 'pending-1',
    description: 'Gym',
    value: 199,
    currency: 'ILS',
    originalAmount: 199,
    exchangeRate: null,
    exchangeRateDate: null,
    exchangeRateSource: null,
    date: '2026-10-30T00:00:00.000Z',
    type: 'EXPENSE',
    category: { id: 'category-1', name: 'Fitness' },
    addedBy: null,
    editedBy: null,
    addedAutomatically: true,
    files: [],
  };
}

describe('PendingTransactionsList', () => {
  it('marks a row the scheduler projected as added automatically', () => {
    renderWithClient(
      <PendingTransactionsList
        transactions={[projectedBySchedule()]}
        onConfirmAction={vi.fn()}
        onDeleteAction={vi.fn()}
      />,
    );

    expect(screen.getByTestId('transaction-attribution').textContent).toBe('Added automatically');
  });
});
