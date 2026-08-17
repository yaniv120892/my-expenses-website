// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UploadQueueList from '@/components/FileUpload/UploadQueueList';
import { UploadItem } from '@/components/FileUpload/uploadQueueReducer';

afterEach(cleanup);

function item(over: Partial<UploadItem> = {}): UploadItem {
  return {
    id: '0',
    file: new File(['content'], 'card-1234.csv', { lastModified: 1 }),
    paymentMonth: '',
    status: 'queued',
    progress: 0,
    ...over,
  };
}

function renderList(
  items: UploadItem[],
  over: Partial<Parameters<typeof UploadQueueList>[0]> = {},
) {
  const props = {
    items,
    isRunning: false,
    onRemove: vi.fn(),
    onRetry: vi.fn(),
    onPaymentMonthChange: vi.fn(),
    ...over,
  };
  render(<UploadQueueList {...props} />);
  return props;
}

describe('UploadQueueList', () => {
  it('renders nothing when the queue is empty', () => {
    const { container } = render(
      <UploadQueueList
        items={[]}
        isRunning={false}
        onRemove={vi.fn()}
        onRetry={vi.fn()}
        onPaymentMonthChange={vi.fn()}
      />,
    );

    expect(container.innerHTML).toBe('');
  });

  it('lists one row per queued file', () => {
    renderList([
      item({ id: '0' }),
      item({
        id: '1',
        file: new File(['x'], 'card-9876.csv', { lastModified: 1 }),
      }),
    ]);

    expect(screen.getByText('card-1234.csv')).toBeTruthy();
    expect(screen.getByText('card-9876.csv')).toBeTruthy();
    expect(screen.queryAllByRole('progressbar')).toHaveLength(0);
  });

  it('shows a status chip per row', () => {
    renderList([
      item({ id: '0', status: 'queued' }),
      item({ id: '1', status: 'uploading' }),
      item({ id: '2', status: 'processing' }),
      item({ id: '3', status: 'failed', error: 'File is too large' }),
    ]);

    expect(screen.getByText('Queued')).toBeTruthy();
    expect(screen.getByText('Uploading')).toBeTruthy();
    expect(screen.getByText('Processing')).toBeTruthy();
    expect(screen.getByText('Failed')).toBeTruthy();
  });

  it('shows a progress bar only while a row is in flight', () => {
    renderList([
      item({ id: '0', status: 'uploading', progress: 40 }),
      item({ id: '1', status: 'queued' }),
      item({ id: '2', status: 'succeeded' }),
    ]);

    expect(screen.getAllByRole('progressbar')).toHaveLength(1);
  });

  it('surfaces the failure reason on the row', () => {
    renderList([item({ status: 'failed', error: 'File is too large' })]);

    expect(screen.getByText('File is too large')).toBeTruthy();
  });

  it('offers retry and remove only on a failed row', async () => {
    const props = renderList([
      item({ id: '0', status: 'failed', error: 'boom' }),
      item({ id: '1', status: 'succeeded' }),
    ]);

    await userEvent.click(screen.getByLabelText('Retry card-1234.csv'));
    expect(props.onRetry).toHaveBeenCalledWith('0');

    // The succeeded row is past the point of retrying or removing.
    expect(screen.getAllByLabelText(/^Retry /)).toHaveLength(1);
    expect(screen.getAllByLabelText(/^Remove /)).toHaveLength(1);
  });

  it('does not let a failed row retry while the batch is still running', () => {
    renderList([item({ status: 'failed', error: 'boom' })], {
      isRunning: true,
    });

    expect(
      screen.getByLabelText('Retry card-1234.csv').hasAttribute('disabled'),
    ).toBe(true);
  });

  it('removes a queued row on request', async () => {
    const props = renderList([item({ id: '0' })]);

    await userEvent.click(screen.getByLabelText('Remove card-1234.csv'));

    expect(props.onRemove).toHaveBeenCalledWith('0');
  });

  it('edits the payment month of a single row', async () => {
    const props = renderList([item({ id: '0' })]);

    await userEvent.type(screen.getByLabelText(/Payment Month/), '0');

    expect(props.onPaymentMonthChange).toHaveBeenCalledWith('0', '0');
  });

  it('locks the payment month once a row leaves the queue', () => {
    renderList([item({ id: '0', status: 'uploading' })]);

    expect(
      screen.getByLabelText(/Payment Month/).hasAttribute('disabled'),
    ).toBe(true);
  });

  it('drops the payment month field for settled rows', () => {
    renderList([
      item({ id: '0', status: 'succeeded' }),
      item({ id: '1', status: 'failed', error: 'boom' }),
    ]);

    expect(screen.queryByLabelText(/Payment Month/)).toBeNull();
  });

  it('shows the file size alongside the name', () => {
    const big = new File([new Uint8Array(2 * 1024 * 1024)], 'big.xlsx', {
      lastModified: 1,
    });
    renderList([item({ file: big })]);

    expect(screen.getByText('2.0 MB')).toBeTruthy();
  });
});
