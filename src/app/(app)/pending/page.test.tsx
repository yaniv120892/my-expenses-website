// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { renderWithClient } from '@/test/renderWithClient';
import theme from '@/theme';
import PendingPage from '@/app/(app)/pending/page';
import { Transaction } from '@/types';

// AmountText reads theme.palette.charts, which only the app theme defines.
function renderPage() {
  return renderWithClient(
    <ThemeProvider theme={theme}>
      <PendingPage />
    </ThemeProvider>,
  );
}

const { queryMock, confirmMutateAsync, deleteMutateAsync } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  confirmMutateAsync: vi.fn(),
  deleteMutateAsync: vi.fn(),
}));

vi.mock('@/hooks/usePendingTransactionsQuery', () => ({
  usePendingTransactionsQuery: queryMock,
  useConfirmTransactionMutation: () => ({ mutateAsync: confirmMutateAsync }),
  useDeletePendingTransactionMutation: () => ({
    mutateAsync: deleteMutateAsync,
  }),
}));

const PENDING_ROW: Transaction = {
  id: '3f2f1a10-6a37-4dc5-9c5e-1f8a5f4d2b6a',
  description: 'Supermarket',
  value: 120,
  date: '2026-03-07',
  type: 'EXPENSE',
  category: { id: 'c1', name: 'Food' },
};

beforeEach(() => {
  vi.clearAllMocks();
  queryMock.mockReturnValue({
    data: [PENDING_ROW],
    isLoading: false,
    isError: false,
  });
});

afterEach(cleanup);

describe('pending page toasts', () => {
  it('shows exactly one error toast when approval fails', async () => {
    confirmMutateAsync.mockRejectedValue(new Error('Approval failed upstream'));
    renderPage();

    await userEvent.click(
      screen.getByRole('button', { name: 'Approve transaction' }),
    );

    expect(await screen.findByText('Approval failed upstream')).toBeTruthy();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.queryByText(/approved successfully/i)).toBeNull();
  });

  it.each([
    ['approve', confirmMutateAsync, 'Transaction approved successfully'],
    ['reject', deleteMutateAsync, 'Transaction rejected successfully'],
  ] as const)(
    'shows a success toast when %s succeeds',
    async (action, mutateAsync, message) => {
      mutateAsync.mockResolvedValue(undefined);
      renderPage();

      await userEvent.click(
        screen.getByRole('button', {
          name:
            action === 'approve' ? 'Approve transaction' : 'Delete transaction',
        }),
      );

      expect(await screen.findByText(message)).toBeTruthy();
    },
  );
});
