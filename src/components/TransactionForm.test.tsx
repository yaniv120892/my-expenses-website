// @vitest-environment jsdom
import React, { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithClient } from '@/test/renderWithClient';
import TransactionForm from '@/components/TransactionForm';

// The S3 upload hook opens network machinery irrelevant to the reset rules.
vi.mock('@/hooks/useTransactionFilesQuery', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useDirectS3UploadForAttachment: () => ({ mutateAsync: vi.fn() }),
}));

const EDIT_ROW = {
  id: '3f2f1a10-6a37-4dc5-9c5e-1f8a5f4d2b6a',
  description: 'Supermarket',
  value: '120',
  categoryId: '',
  type: 'EXPENSE' as const,
  date: '2026-03-07',
};

// Reproduces how pages pass initialData: a fresh object literal per render,
// so any parent re-render changes its identity.
function EditHarness({ description = EDIT_ROW.description }) {
  const [, rerender] = useState(0);
  return (
    <>
      <button onClick={() => rerender((n) => n + 1)}>force-rerender</button>
      <TransactionForm
        open
        onCloseAction={() => {}}
        onSubmitAction={async () => {}}
        initialData={{ ...EDIT_ROW, description }}
      />
    </>
  );
}

function descriptionInput(): HTMLInputElement {
  return screen.getByRole('textbox', {
    name: /description/i,
  }) as HTMLInputElement;
}

describe('TransactionForm reset rules', () => {
  it('keeps typed input across a parent re-render with a fresh initialData object', () => {
    renderWithClient(<EditHarness />);

    fireEvent.change(descriptionInput(), {
      target: { value: 'Supermarket — weekly run' },
    });
    fireEvent.click(screen.getByText('force-rerender'));

    expect(descriptionInput().value).toBe('Supermarket — weekly run');
  });

  it('resets when the edited row actually changes', () => {
    const { rerender } = renderWithClient(
      <TransactionForm
        open
        onCloseAction={() => {}}
        onSubmitAction={async () => {}}
        initialData={EDIT_ROW}
      />,
    );
    fireEvent.change(descriptionInput(), { target: { value: 'typed' } });

    rerender(
      <TransactionForm
        open
        onCloseAction={() => {}}
        onSubmitAction={async () => {}}
        initialData={{
          ...EDIT_ROW,
          id: '99999999-9999-4999-8999-999999999999',
          description: 'Other row',
        }}
      />,
    );

    expect(descriptionInput().value).toBe('Other row');
  });

  it('resets to defaults when reopened in create mode', () => {
    const { rerender } = renderWithClient(
      <TransactionForm
        open
        onCloseAction={() => {}}
        onSubmitAction={async () => {}}
        initialData={null}
      />,
    );
    fireEvent.change(descriptionInput(), { target: { value: 'draft text' } });

    rerender(
      <TransactionForm
        open={false}
        onCloseAction={() => {}}
        onSubmitAction={async () => {}}
        initialData={null}
      />,
    );
    rerender(
      <TransactionForm
        open
        onCloseAction={() => {}}
        onSubmitAction={async () => {}}
        initialData={null}
      />,
    );

    expect(descriptionInput().value).toBe('');
  });
});
