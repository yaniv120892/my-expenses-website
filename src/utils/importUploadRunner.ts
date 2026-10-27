import { runWithConcurrency } from '@/utils/asyncPool';
import { describeApiError } from '@/utils/api';
import type { UploadItem, UploadItemError, UploadQueueAction } from '@/utils/importUploadQueue';
import { normalizePaymentMonth } from '@/shared/paymentMonth';
import { isUnreadablePaymentMonth } from '@/utils/paymentMonth';

export interface UploadRunnerApi {
  uploadImportFile(
    formData: FormData,
    onProgress?: (progress: number) => void,
  ): Promise<{ fileUrl: string }>;
  processImport(
    fileUrl: string,
    originalFileName: string,
    paymentMonth?: string,
  ): Promise<{ id: string }>;
}

export type UploadDispatch = (action: UploadQueueAction) => void;

export async function runUploadItem(
  item: UploadItem,
  api: UploadRunnerApi,
  dispatch: UploadDispatch,
): Promise<void> {
  const paymentMonth = readPaymentMonth(item.paymentMonth);
  let fileUrl = item.fileUrl;

  if (!fileUrl) {
    dispatch({ type: 'UPLOAD_STARTED', id: item.id });

    // Safari loses the backing store of a File held across an async gap, so
    // the bytes are re-wrapped into a Blob before the request starts.
    const arrayBuffer = await item.file.arrayBuffer();
    const blob = new Blob([arrayBuffer], {
      type: item.file.type || 'application/octet-stream',
    });

    const formData = new FormData();
    formData.append('file', blob, item.file.name);

    const uploaded = await api.uploadImportFile(formData, (progress) =>
      dispatch({
        type: 'UPLOAD_PROGRESS',
        id: item.id,
        // Rounded so a stream of sub-percent XHR events collapses into at
        // most 100 state updates per file.
        progress: Math.round(progress),
      }),
    );
    fileUrl = uploaded.fileUrl;
  }

  dispatch({ type: 'UPLOAD_SUCCEEDED', id: item.id, fileUrl });

  const created = await api.processImport(fileUrl, item.file.name, paymentMonth);

  dispatch({ type: 'ITEM_SUCCEEDED', id: item.id, importId: created.id });
}

// Checked before the upload, which the server's 400 on this month would
// otherwise only follow.
function readPaymentMonth(raw: string): string | undefined {
  if (isUnreadablePaymentMonth(raw)) {
    throw new InvalidPaymentMonthError(raw);
  }
  return normalizePaymentMonth(raw) ?? undefined;
}

export async function runUploadBatch(
  batch: UploadItem[],
  api: UploadRunnerApi,
  dispatch: UploadDispatch,
  concurrency: number,
): Promise<void> {
  await runWithConcurrency(batch, concurrency, async (item) => {
    try {
      await runUploadItem(item, api, dispatch);
    } catch (error) {
      dispatch({
        type: 'ITEM_FAILED',
        id: item.id,
        error: toUploadItemError(error),
      });
    }
  });
}

export class InvalidPaymentMonthError extends Error {
  constructor(raw: string) {
    super(`Payment month must be MM/YYYY (got "${raw}")`);
    this.name = 'InvalidPaymentMonthError';
  }
}

function toUploadItemError(error: unknown): UploadItemError {
  if (error instanceof InvalidPaymentMonthError) {
    return { code: 'INVALID_PAYMENT_MONTH' };
  }
  const message = describeApiError(error, '');
  return { code: 'REQUEST_FAILED', message: message || null };
}
