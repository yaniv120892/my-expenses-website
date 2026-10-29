// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import { renderWithClient } from '@/test/renderWithClient';
import PendingTransactionsPopup from '@/components/PendingTransactionsPopup';

const { usePendingTransactionsQuery } = vi.hoisted(() => ({
  usePendingTransactionsQuery: vi.fn(),
}));

vi.mock('@/hooks/usePendingTransactionsQuery', () => ({ usePendingTransactionsQuery }));

const STORAGE_KEY = 'pendingTransactionsSeenDate';
const TODAY = new Date().toISOString().slice(0, 10);

function pending(count: number) {
  return { data: Array.from({ length: count }, (_, index) => ({ id: String(index) })) };
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe('PendingTransactionsPopup', () => {
  it('opens once pending transactions arrive and records today as seen', () => {
    usePendingTransactionsQuery.mockReturnValue(pending(0));
    const { rerender } = renderWithClient(<PendingTransactionsPopup />);
    expect(screen.queryByRole('alert')).toBeNull();

    usePendingTransactionsQuery.mockReturnValue(pending(2));
    rerender(<PendingTransactionsPopup />);

    expect(screen.getByRole('alert').textContent).toContain('2');
    expect(localStorage.getItem(STORAGE_KEY)).toBe(TODAY);
  });

  it('stays closed when the popup was already seen today', () => {
    localStorage.setItem(STORAGE_KEY, TODAY);
    usePendingTransactionsQuery.mockReturnValue(pending(3));

    renderWithClient(<PendingTransactionsPopup />);

    expect(screen.queryByRole('alert')).toBeNull();
  });
});
