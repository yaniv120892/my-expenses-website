import { describe, it, expect, vi } from 'vitest';
import {
  UploadItem,
  UploadQueueAction,
} from '@/components/FileUpload/uploadQueueReducer';
import {
  runUploadBatch,
  runUploadItem,
  UploadRunnerApi,
} from '@/components/FileUpload/uploadRunner';

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

function buildApi(over: Partial<UploadRunnerApi> = {}): UploadRunnerApi {
  return {
    uploadImportFile: vi.fn(async () => ({ fileUrl: 'https://s3/a.csv' })),
    processImport: vi.fn(async () => ({ id: 'import-1' })),
    ...over,
  };
}

function recorder() {
  const actions: UploadQueueAction[] = [];
  return {
    actions,
    dispatch: (action: UploadQueueAction) => actions.push(action),
  };
}

const types = (actions: UploadQueueAction[]) => actions.map((a) => a.type);

describe('runUploadItem', () => {
  it('uploads then processes, reporting each step', async () => {
    const api = buildApi();
    const { actions, dispatch } = recorder();

    await runUploadItem(item(), api, dispatch);

    expect(types(actions)).toEqual([
      'UPLOAD_STARTED',
      'UPLOAD_SUCCEEDED',
      'ITEM_SUCCEEDED',
    ]);
    expect(actions[1]).toMatchObject({ fileUrl: 'https://s3/a.csv' });
    expect(actions[2]).toMatchObject({ importId: 'import-1' });
  });

  it('sends the file under its original name', async () => {
    const api = buildApi();

    await runUploadItem(item(), api, recorder().dispatch);

    const formData = vi.mocked(api.uploadImportFile).mock.calls[0][0];
    const sent = formData.get('file') as File;
    expect(sent.name).toBe('card-1234.csv');
  });

  it('passes the per-file payment month through to the import', async () => {
    const api = buildApi();

    await runUploadItem(
      item({ paymentMonth: '01/2024' }),
      api,
      recorder().dispatch,
    );

    expect(api.processImport).toHaveBeenCalledWith(
      'https://s3/a.csv',
      'card-1234.csv',
      '01/2024',
    );
  });

  it('sends no payment month when the field was left blank', async () => {
    const api = buildApi();

    await runUploadItem(item(), api, recorder().dispatch);

    expect(api.processImport).toHaveBeenCalledWith(
      'https://s3/a.csv',
      'card-1234.csv',
      undefined,
    );
  });

  it('forwards upload progress', async () => {
    const api = buildApi({
      uploadImportFile: vi.fn(async (_formData, onProgress) => {
        onProgress?.(50);
        return { fileUrl: 'https://s3/a.csv' };
      }),
    });
    const { actions, dispatch } = recorder();

    await runUploadItem(item(), api, dispatch);

    expect(actions).toContainEqual({
      type: 'UPLOAD_PROGRESS',
      id: '0',
      progress: 50,
    });
  });

  it('skips re-uploading a retry whose bytes already landed', async () => {
    const api = buildApi();
    const { actions, dispatch } = recorder();

    await runUploadItem(
      item({ fileUrl: 'https://s3/already.csv' }),
      api,
      dispatch,
    );

    expect(api.uploadImportFile).not.toHaveBeenCalled();
    expect(types(actions)).toEqual(['UPLOAD_SUCCEEDED', 'ITEM_SUCCEEDED']);
    expect(api.processImport).toHaveBeenCalledWith(
      'https://s3/already.csv',
      'card-1234.csv',
      undefined,
    );
  });

  it('does not process when the upload fails', async () => {
    const api = buildApi({
      uploadImportFile: vi.fn(async () => {
        throw new Error('File is too large');
      }),
    });

    await expect(
      runUploadItem(item(), api, recorder().dispatch),
    ).rejects.toThrow('File is too large');
    expect(api.processImport).not.toHaveBeenCalled();
  });
});

describe('runUploadBatch', () => {
  it('turns a failure into a row error without stopping the batch', async () => {
    const api = buildApi({
      processImport: vi.fn(async (_url, name) => {
        if (name === 'bad.csv') throw new Error('Unsupported file type');
        return { id: 'import-ok' };
      }),
    });
    const { actions, dispatch } = recorder();
    const batch = [
      item({ id: '0' }),
      item({
        id: '1',
        file: new File(['x'], 'bad.csv', { lastModified: 1 }),
      }),
      item({ id: '2' }),
    ];

    await runUploadBatch(batch, api, dispatch, 2);

    expect(actions).toContainEqual({
      type: 'ITEM_FAILED',
      id: '1',
      error: 'Unsupported file type',
    });
    expect(
      actions.filter((a) => a.type === 'ITEM_SUCCEEDED').map((a) => a.id),
    ).toEqual(['0', '2']);
  });

  it('falls back to a generic message for a non-Error rejection', async () => {
    const api = buildApi({
      processImport: vi.fn(async () => {
        throw 'nope';
      }),
    });
    const { actions, dispatch } = recorder();

    await runUploadBatch([item()], api, dispatch, 2);

    expect(actions).toContainEqual({
      type: 'ITEM_FAILED',
      id: '0',
      error: 'Failed to import file',
    });
  });

  it('never runs more uploads at once than the limit', async () => {
    let inFlight = 0;
    let peak = 0;
    const api = buildApi({
      uploadImportFile: vi.fn(async () => {
        inFlight++;
        peak = Math.max(peak, inFlight);
        await Promise.resolve();
        inFlight--;
        return { fileUrl: 'https://s3/a.csv' };
      }),
    });
    const batch = ['0', '1', '2', '3', '4'].map((id) => item({ id }));

    await runUploadBatch(batch, api, recorder().dispatch, 2);

    expect(peak).toBe(2);
  });

  it('processes every file in the batch', async () => {
    const api = buildApi();
    const batch = ['0', '1', '2'].map((id) => item({ id }));

    await runUploadBatch(batch, api, recorder().dispatch, 2);

    expect(api.processImport).toHaveBeenCalledTimes(3);
  });
});
