import { runWithConcurrency } from '@/utils/asyncPool';
import { handleApiError } from '@/utils/api';
import { UploadItem, UploadQueueAction } from '@/utils/importUploadQueue';

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

  const created = await api.processImport(
    fileUrl,
    item.file.name,
    item.paymentMonth || undefined,
  );

  dispatch({ type: 'ITEM_SUCCEEDED', id: item.id, importId: created.id });
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
        error: handleApiError(error, 'Failed to import file'),
      });
    }
  });
}
