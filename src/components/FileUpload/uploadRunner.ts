import { runWithConcurrency } from '@/utils/asyncPool';
import { UploadItem, UploadQueueAction } from './uploadQueueReducer';

/** The slice of the imports API the runner needs, so tests can supply their own. */
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

export function getUploadErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'Failed to import file';
}

/**
 * Uploads one queued file and turns it into an import. An item that already
 * carries a fileUrl is being retried after its upload succeeded, so the bytes
 * are not sent again.
 */
export async function runUploadItem(
  item: UploadItem,
  api: UploadRunnerApi,
  dispatch: UploadDispatch,
): Promise<void> {
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
      dispatch({ type: 'UPLOAD_PROGRESS', id: item.id, progress }),
    );
    fileUrl = uploaded.fileUrl;
  }

  dispatch({ type: 'UPLOAD_SUCCEEDED', id: item.id, fileUrl });

  const created = await api.processImport(
    fileUrl,
    item.file.name,
    item.paymentMonth || undefined,
  );

  dispatch({ type: 'ITEM_SUCCEEDED', id: item.id, importId: created.id });
}

/**
 * Runs a batch of queued items, bounded by `concurrency`. A failing item is
 * reported on its own row and never stops the rest of the batch.
 */
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
        error: getUploadErrorMessage(error),
      });
    }
  });
}
