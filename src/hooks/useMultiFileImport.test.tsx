// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const { uploadImportFile, processImport } = vi.hoisted(() => ({
  uploadImportFile: vi.fn(),
  processImport: vi.fn(),
}));

vi.mock('@/services/importService', () => ({
  importService: { uploadImportFile, processImport },
}));

import { useMultiFileImport } from '@/hooks/useMultiFileImport';
import { createWrapper } from '@/test/renderWithClient';

const file = (name: string) =>
  new File(['content'], name, { lastModified: 1, type: 'text/csv' });

function setup(onAllSucceeded?: () => void) {
  return renderHook(() => useMultiFileImport({ onAllSucceeded }), {
    wrapper: createWrapper(),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  uploadImportFile.mockResolvedValue({ fileUrl: 'https://s3/a.csv' });
  processImport.mockImplementation(async (_url, name) => ({
    id: `import-${name}`,
  }));
});

describe('useMultiFileImport', () => {
  it('turns each queued file into its own import', async () => {
    const { result } = setup();

    act(() => result.current.addFiles([file('a.csv'), file('b.csv')], ''));
    expect(result.current.queuedCount).toBe(2);

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.items.map((i) => i.status)).toEqual([
      'succeeded',
      'succeeded',
    ]);
    expect(result.current.items.map((i) => i.importId)).toEqual([
      'import-a.csv',
      'import-b.csv',
    ]);
    expect(processImport).toHaveBeenCalledTimes(2);
  });

  it('applies the payment month captured when the files were added', async () => {
    const { result } = setup();

    act(() => result.current.addFiles([file('a.csv')], '01/2024'));
    await act(async () => {
      await result.current.start();
    });

    expect(processImport).toHaveBeenCalledWith(
      'https://s3/a.csv',
      'a.csv',
      '01/2024',
    );
  });

  it('sends a per-row payment month edit', async () => {
    const { result } = setup();

    act(() =>
      result.current.addFiles([file('a.csv'), file('b.csv')], '01/2024'),
    );
    act(() => result.current.setPaymentMonth('1', '02/2024'));
    await act(async () => {
      await result.current.start();
    });

    expect(processImport).toHaveBeenNthCalledWith(
      2,
      'https://s3/a.csv',
      'b.csv',
      '02/2024',
    );
  });

  it('fails only the offending row and keeps the rest', async () => {
    processImport.mockImplementation(async (_url, name) => {
      if (name === 'bad.csv') {
        throw new Error('Unsupported file type');
      }
      return { id: 'import-ok' };
    });
    const { result } = setup();

    act(() =>
      result.current.addFiles(
        [file('a.csv'), file('bad.csv'), file('c.csv')],
        '',
      ),
    );
    await act(async () => {
      await result.current.start();
    });

    expect(result.current.items.map((i) => i.status)).toEqual([
      'succeeded',
      'failed',
      'succeeded',
    ]);
    expect(result.current.items[1].error).toBe('Unsupported file type');
    expect(result.current.hasFailures).toBe(true);
    expect(result.current.summary).toEqual({
      total: 3,
      succeeded: 2,
      failed: 1,
      errors: [{ id: 'bad.csv', error: 'Unsupported file type' }],
    });
  });

  it('retries a failed row without re-uploading the bytes', async () => {
    processImport.mockRejectedValueOnce(new Error('agent down'));
    const { result } = setup();

    act(() => result.current.addFiles([file('a.csv')], ''));
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.items[0].status).toBe('failed');
    expect(uploadImportFile).toHaveBeenCalledTimes(1);

    await act(async () => {
      result.current.retryItem('0');
    });

    await waitFor(() =>
      expect(result.current.items[0].status).toBe('succeeded'),
    );
    expect(uploadImportFile).toHaveBeenCalledTimes(1);
    expect(processImport).toHaveBeenCalledTimes(2);
  });

  it('retries every failed row at once', async () => {
    processImport.mockRejectedValue(new Error('agent down'));
    const { result } = setup();

    act(() => result.current.addFiles([file('a.csv'), file('b.csv')], ''));
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.hasFailures).toBe(true);

    processImport.mockResolvedValue({ id: 'import-1' });
    await act(async () => {
      result.current.retryAllFailed();
    });

    await waitFor(() => expect(result.current.hasFailures).toBe(false));
  });

  it('reports completion once, and only when nothing failed', async () => {
    const onAllSucceeded = vi.fn();
    const { result } = setup(onAllSucceeded);

    act(() => result.current.addFiles([file('a.csv')], ''));
    await act(async () => {
      await result.current.start();
    });

    await waitFor(() => expect(onAllSucceeded).toHaveBeenCalledTimes(1));
  });

  it('does not report completion when a row failed', async () => {
    processImport.mockRejectedValue(new Error('agent down'));
    const onAllSucceeded = vi.fn();
    const { result } = setup(onAllSucceeded);

    act(() => result.current.addFiles([file('a.csv')], ''));
    await act(async () => {
      await result.current.start();
    });

    expect(onAllSucceeded).not.toHaveBeenCalled();
  });

  it('ignores a duplicate drop of a file already queued', () => {
    const { result } = setup();
    const dropped = file('a.csv');

    act(() => result.current.addFiles([dropped], ''));
    act(() => result.current.addFiles([dropped], ''));

    expect(result.current.items).toHaveLength(1);
  });

  it('drops a queued row on request', () => {
    const { result } = setup();

    act(() => result.current.addFiles([file('a.csv'), file('b.csv')], ''));
    act(() => result.current.removeItem('0'));

    expect(result.current.items.map((i) => i.file.name)).toEqual(['b.csv']);
  });

  it('applies a payment month to every row still in play', () => {
    const { result } = setup();

    act(() => result.current.addFiles([file('a.csv'), file('b.csv')], ''));
    act(() => result.current.applyPaymentMonthToAll('03/2024'));

    expect(result.current.items.map((i) => i.paymentMonth)).toEqual([
      '03/2024',
      '03/2024',
    ]);
  });

  it('starting with nothing queued does no work', async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.start();
    });

    expect(uploadImportFile).not.toHaveBeenCalled();
  });
});
