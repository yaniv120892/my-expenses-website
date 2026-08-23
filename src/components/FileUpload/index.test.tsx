// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { uploadImportFile, processImport } = vi.hoisted(() => ({
  uploadImportFile: vi.fn(),
  processImport: vi.fn(),
}));

vi.mock('@/services/importService', () => ({
  importService: { uploadImportFile, processImport },
}));

import FileUpload from '@/components/FileUpload';
import { renderWithClient } from '@/test/renderWithClient';

const csv = (name: string) =>
  new File(['date,amount'], name, { lastModified: 1, type: 'text/csv' });

/** react-dropzone renders a hidden file input; selecting through it is the drop. */
function fileInput(): HTMLInputElement {
  return document.querySelector('input[type="file"]') as HTMLInputElement;
}

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  uploadImportFile.mockResolvedValue({ fileUrl: 'https://s3/a.csv' });
  processImport.mockImplementation(async (_url, name) => ({
    id: `import-${name}`,
  }));
});

describe('FileUpload', () => {
  it('invites the user to add several files', () => {
    renderWithClient(<FileUpload />);

    expect(
      screen.getByText('Drag and drop files here, or click to select'),
    ).toBeTruthy();
    expect(screen.getByText(/Each file becomes its own import/)).toBeTruthy();
  });

  it('queues each selected file as its own row without uploading yet', async () => {
    renderWithClient(<FileUpload />);

    await userEvent.upload(fileInput(), [
      csv('card-1234.csv'),
      csv('card-9876.csv'),
    ]);

    expect(screen.getByText('card-1234.csv')).toBeTruthy();
    expect(screen.getByText('card-9876.csv')).toBeTruthy();
    expect(uploadImportFile).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Upload 2 files' })).toBeTruthy();
  });

  it('singularises the upload button for one file', async () => {
    renderWithClient(<FileUpload />);

    await userEvent.upload(fileInput(), [csv('card-1234.csv')]);

    expect(screen.getByRole('button', { name: 'Upload 1 file' })).toBeTruthy();
  });

  it('offers no upload button until something is queued', () => {
    renderWithClient(<FileUpload />);

    expect(screen.queryByRole('button', { name: /^Upload / })).toBeNull();
  });

  it('imports every queued file and reports completion', async () => {
    const onUploadComplete = vi.fn();
    renderWithClient(<FileUpload onUploadComplete={onUploadComplete} />);

    await userEvent.upload(fileInput(), [csv('a.csv'), csv('b.csv')]);
    await userEvent.click(
      screen.getByRole('button', { name: 'Upload 2 files' }),
    );

    await waitFor(() => expect(processImport).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(onUploadComplete).toHaveBeenCalledTimes(1));
  });

  it('applies the batch payment month to files added afterwards', async () => {
    renderWithClient(<FileUpload />);

    await userEvent.type(
      screen.getByLabelText('Default Payment Month (MM/YYYY)'),
      '01/2024',
    );
    await userEvent.upload(fileInput(), [csv('a.csv')]);
    await userEvent.click(
      screen.getByRole('button', { name: 'Upload 1 file' }),
    );

    await waitFor(() =>
      expect(processImport).toHaveBeenCalledWith(
        'https://s3/a.csv',
        'a.csv',
        '01/2024',
      ),
    );
  });

  it('back-fills already-queued rows with "Apply to all"', async () => {
    renderWithClient(<FileUpload />);

    await userEvent.upload(fileInput(), [csv('a.csv')]);
    await userEvent.type(
      screen.getByLabelText('Default Payment Month (MM/YYYY)'),
      '02/2024',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Apply to all' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Upload 1 file' }),
    );

    await waitFor(() =>
      expect(processImport).toHaveBeenCalledWith(
        'https://s3/a.csv',
        'a.csv',
        '02/2024',
      ),
    );
  });

  it('keeps the dialog open and offers a retry when a file fails', async () => {
    processImport.mockImplementation(async (_url, name) => {
      if (name === 'bad.csv') {
        throw new Error('Unsupported file type');
      }
      return { id: 'import-ok' };
    });
    const onUploadComplete = vi.fn();
    renderWithClient(<FileUpload onUploadComplete={onUploadComplete} />);

    await userEvent.upload(fileInput(), [csv('good.csv'), csv('bad.csv')]);
    await userEvent.click(
      screen.getByRole('button', { name: 'Upload 2 files' }),
    );

    await waitFor(() =>
      expect(screen.getByText('Unsupported file type')).toBeTruthy(),
    );
    expect(onUploadComplete).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Retry bad.csv')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry failed' })).toBeTruthy();
    expect(
      screen.getByText(/1 of 2 files processed successfully/),
    ).toBeTruthy();
  });

  it('reports whether a batch is running so the dialog can block closing', async () => {
    const onRunningChange = vi.fn();
    renderWithClient(<FileUpload onRunningChange={onRunningChange} />);

    await userEvent.upload(fileInput(), [csv('a.csv')]);
    await userEvent.click(
      screen.getByRole('button', { name: 'Upload 1 file' }),
    );

    await waitFor(() => expect(onRunningChange).toHaveBeenCalledWith(true));
    await waitFor(() =>
      expect(onRunningChange).toHaveBeenLastCalledWith(false),
    );
  });

  it('ignores a second selection of the same file', async () => {
    renderWithClient(<FileUpload />);
    const duplicate = csv('a.csv');

    await userEvent.upload(fileInput(), [duplicate]);
    await userEvent.upload(fileInput(), [duplicate]);

    expect(screen.getAllByText('a.csv')).toHaveLength(1);
  });
});
