// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { renderWithClient } from '@/test/renderWithClient';
import TransactionForm from '@/components/TransactionForm';

// The attachments panel fetches the edit row's files on render; the reset
// rules under test never need the network.
vi.mock('@/services/transactionFileService', () => ({
  listFiles: vi.fn().mockResolvedValue([]),
}));

const upload = vi.fn();

// The real panel adds pending files through react-dropzone; this stub is the
// smallest seam that lets a test put one into TransactionForm's own state.
vi.mock('@/components/TransactionForm/TransactionAttachments', () => ({
  default: ({
    setPendingFiles,
  }: {
    setPendingFiles: (files: File[]) => void;
  }) => (
    <button
      onClick={() =>
        setPendingFiles([new File(['x'], 'receipt.png', { type: 'image/png' })])
      }
    >
      stub-add-pending-file
    </button>
  ),
}));

vi.mock('@/hooks/useTransactionFilesQuery', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/hooks/useTransactionFilesQuery')>();
  return {
    ...actual,
    useDirectS3UploadForAttachment: () => ({ upload }),
  };
});

afterEach(cleanup);

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
function EditHarness() {
  const [, rerender] = useState(0);
  return (
    <>
      <button onClick={() => rerender((n) => n + 1)}>force-rerender</button>
      <TransactionForm
        open
        onCloseAction={() => {}}
        onSubmitAction={async () => {}}
        initialData={{ ...EDIT_ROW }}
      />
    </>
  );
}

function descriptionInput(): HTMLInputElement {
  return screen.getByRole('textbox', {
    name: /description/i,
  }) as HTMLInputElement;
}

function valueInput(): HTMLElement {
  return screen.getByRole('spinbutton', { name: /value/i });
}

type SubmitAction = React.ComponentProps<
  typeof TransactionForm
>['onSubmitAction'];

describe('TransactionForm reset rules', () => {
  it('populates from initialData on first mount', () => {
    renderWithClient(
      <TransactionForm
        open
        onCloseAction={() => {}}
        onSubmitAction={async () => {}}
        initialData={EDIT_ROW}
      />,
    );

    expect(descriptionInput().value).toBe('Supermarket');
  });

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

describe('TransactionForm submit failure reporting', () => {
  function renderCreateForm(
    onSubmitAction: SubmitAction,
    onCloseAction: () => void,
  ) {
    renderWithClient(
      <TransactionForm
        open
        onCloseAction={onCloseAction}
        onSubmitAction={onSubmitAction}
        initialData={null}
      />,
    );
    fireEvent.change(descriptionInput(), { target: { value: 'Supermarket' } });
    fireEvent.change(valueInput(), { target: { value: '120' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
  }

  it("stays open and shows the server's message when onSubmitAction rejects", async () => {
    const onCloseAction = vi.fn();
    renderCreateForm(async () => {
      throw new Error('Category not found');
    }, onCloseAction);

    expect(await screen.findByText('Category not found')).toBeTruthy();
    expect(onCloseAction).not.toHaveBeenCalled();
    expect(screen.queryByText(/created successfully/i)).toBeNull();
  });

  it('falls back to a friendly message for an axios generic error', async () => {
    renderCreateForm(async () => {
      throw new Error('Network Error');
    }, vi.fn());

    expect(await screen.findByText('Failed to save transaction')).toBeTruthy();
  });

  it('reports success and closes when onSubmitAction resolves', async () => {
    const onCloseAction = vi.fn();
    renderCreateForm(async () => 'new-id', onCloseAction);

    expect(
      await screen.findByText('Transaction created successfully'),
    ).toBeTruthy();
    expect(onCloseAction).toHaveBeenCalled();
  });
});

describe('TransactionForm attachment failure reporting', () => {
  it('still reports the save as done when an attachment upload fails', async () => {
    upload.mockRejectedValue(new Error('S3 refused the part'));
    const onCloseAction = vi.fn();
    const onSubmitAction = vi.fn(async () => 'new-id');

    renderWithClient(
      <TransactionForm
        open
        onCloseAction={onCloseAction}
        onSubmitAction={onSubmitAction}
        initialData={null}
      />,
    );
    fireEvent.change(descriptionInput(), { target: { value: 'With receipt' } });
    fireEvent.change(valueInput(), { target: { value: '18' } });
    fireEvent.click(screen.getByText('stub-add-pending-file'));
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(
      await screen.findByText(/Transaction saved\. Direct S3 upload failed\./),
    ).toBeTruthy();
    expect(screen.queryByText('Failed to save transaction')).toBeNull();
    expect(screen.queryByText(/created successfully/i)).toBeNull();
    expect(onSubmitAction).toHaveBeenCalledTimes(1);
  });
});
