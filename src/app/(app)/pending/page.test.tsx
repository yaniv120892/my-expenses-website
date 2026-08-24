// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { renderWithClient } from '@/test/renderWithClient';
import theme from '@/theme';
import PendingPage from '@/app/(app)/pending/page';

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

const PENDING_ROW = {
  id: '3f2f1a10-6a37-4dc5-9c5e-1f8a5f4d2b6a',
  description: 'Supermarket',
  value: 120,
  date: new Date('2026-03-07T00:00:00Z'),
  type: 'EXPENSE',
  status: 'PENDING_APPROVAL',
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

    fireEvent.click(screen.getAllByLabelText(/approve/i)[0]);

    expect(await screen.findByText('Approval failed upstream')).toBeTruthy();
    expect(screen.queryByText(/approved successfully/i)).toBeNull();
  });

  it('shows a success toast when approval succeeds', async () => {
    confirmMutateAsync.mockResolvedValue(undefined);
    renderPage();

    fireEvent.click(screen.getAllByLabelText(/approve/i)[0]);

    expect(
      await screen.findByText('Transaction approved successfully'),
    ).toBeTruthy();
  });
});
