// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import { renderWithClient } from '@/test/renderWithClient';
import TransactionAttachments from '@/components/TransactionForm/TransactionAttachments';

let nextUrl = 0;
const createObjectURL = vi.fn(() => `blob:stub-${nextUrl++}`);
const revokeObjectURL = vi.fn();

beforeEach(() => {
  nextUrl = 0;
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
  // jsdom implements neither.
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;
});

afterEach(cleanup);

const PENDING_IMAGE = new File(['x'], 'receipt.png', { type: 'image/png' });

function attachmentsWith(...files: File[]) {
  return (
    <TransactionAttachments
      pendingFiles={files}
      setPendingFiles={() => {}}
      filesToRemove={[]}
      setFilesToRemove={() => {}}
    />
  );
}

function renderWithPendingImage() {
  return renderWithClient(attachmentsWith(PENDING_IMAGE));
}

describe('pending image previews', () => {
  it('mints one object URL per file, not one per render', async () => {
    const { rerender } = renderWithPendingImage();
    await screen.findByText('receipt.png');

    rerender(attachmentsWith(PENDING_IMAGE));
    rerender(attachmentsWith(PENDING_IMAGE));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
  });

  it('revokes the object URL when the preview unmounts', async () => {
    const { unmount } = renderWithPendingImage();
    await screen.findByText('receipt.png');
    expect(revokeObjectURL).not.toHaveBeenCalled();

    unmount();

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:stub-0');
  });
});

describe('removing one of several pending images', () => {
  it('revokes the removed file and leaves the survivor a live URL', async () => {
    const first = new File(['a'], 'first.png', { type: 'image/png' });
    const second = new File(['b'], 'second.png', { type: 'image/png' });
    const { rerender } = renderWithClient(attachmentsWith(first, second));
    await screen.findByText('first.png');
    expect(createObjectURL).toHaveBeenCalledTimes(2);

    rerender(attachmentsWith(second));
    await screen.findByText('second.png');

    // Whatever the survivor ends up holding must not be among the revoked.
    const revoked = revokeObjectURL.mock.calls.map((call) => call[0]);
    const live = createObjectURL.mock.results
      .map((result) => result.value)
      .filter((url) => !revoked.includes(url));
    expect(revoked).toContain('blob:stub-0');
    expect(live).toHaveLength(1);
  });
});
