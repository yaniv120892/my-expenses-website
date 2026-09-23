// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithClient } from '@/test/renderWithClient';
import CategoryConfirmationSnackbar from '@/components/CategoryConfirmationSnackbar';
import { updateTransaction } from '@/services/transactions';
import { CreateTransactionInput } from '@/types';

vi.mock('@/services/transactions', () => ({
  updateTransaction: vi.fn(),
}));

vi.mock('@/components/CategorySelect', () => ({
  default: ({ onChange }: { onChange: (value: string) => void }) => (
    <button onClick={() => onChange(CHOSEN_CATEGORY_ID)}>stub-pick</button>
  ),
}));

const CHOSEN_CATEGORY_ID = '7b0c1c52-3f7e-4b8e-9a51-0a3e0f7a2c11';
const TRANSACTION_ID = '3f2f1a10-6a37-4dc5-9c5e-1f8a5f4d2b6a';
const CREATED_INPUT: CreateTransactionInput = {
  description: 'Supermarket',
  value: 120,
  categoryId: undefined,
  type: 'EXPENSE',
  date: '2026-03-07',
};

const updateTransactionMock = vi.mocked(updateTransaction);

beforeEach(() => {
  updateTransactionMock.mockReset();
});
afterEach(cleanup);

function renderSnackbar(onClose = vi.fn()) {
  renderWithClient(
    <CategoryConfirmationSnackbar
      open
      transactionId={TRANSACTION_ID}
      transactionInput={CREATED_INPUT}
      suggestedCategory={{ id: 'suggested', name: 'Groceries' }}
      onClose={onClose}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Change' }));
  fireEvent.click(screen.getByRole('button', { name: 'stub-pick' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  return onClose;
}

describe('CategoryConfirmationSnackbar', () => {
  it('resends the whole created transaction with the chosen category', async () => {
    updateTransactionMock.mockResolvedValue('ok');
    const onClose = renderSnackbar();

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(updateTransactionMock).toHaveBeenCalledWith(TRANSACTION_ID, {
      ...CREATED_INPUT,
      categoryId: CHOSEN_CATEGORY_ID,
    });
  });

  it('keeps the dialog open and shows the error when the update fails', async () => {
    updateTransactionMock.mockRejectedValue(new Error('Validation failed'));
    const onClose = renderSnackbar();

    expect(await screen.findByText('Validation failed')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });
});
