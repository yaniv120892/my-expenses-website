import { describe, it, expect } from 'vitest';
import {
  initialUploadQueueState,
  planAddFiles,
  selectIsDrained,
  selectIsRunning,
  selectQueuedItems,
  toBatchResult,
  uploadQueueReducer,
  UploadQueueAction,
  UploadQueueState,
} from '@/utils/importUploadQueue';

function file(name: string, lastModified = 1): File {
  return new File(['content'], name, { lastModified });
}

function reduce(
  state: UploadQueueState,
  ...actions: UploadQueueAction[]
): UploadQueueState {
  return actions.reduce(uploadQueueReducer, state);
}

function withFiles(files: File[], paymentMonth = ''): UploadQueueState {
  return reduce(initialUploadQueueState, {
    type: 'ADD_FILES',
    files,
    paymentMonth,
  });
}

describe('uploadQueueReducer', () => {
  it('queues added files with the batch payment month', () => {
    const state = withFiles([file('a.csv'), file('b.csv')], '01/2024');

    expect(state.items.map((item) => item.file.name)).toEqual([
      'a.csv',
      'b.csv',
    ]);
    expect(state.items.every((item) => item.status === 'queued')).toBe(true);
    expect(state.items.every((item) => item.paymentMonth === '01/2024')).toBe(
      true,
    );
  });

  it('keeps ids stable and unique after a removal', () => {
    const state = reduce(
      withFiles([file('a.csv'), file('b.csv')]),
      { type: 'REMOVE_ITEM', id: '0' },
      { type: 'ADD_FILES', files: [file('c.csv')], paymentMonth: '' },
    );

    expect(state.items.map((item) => item.id)).toEqual(['1', '2']);
    expect(state.items.map((item) => item.file.name)).toEqual([
      'b.csv',
      'c.csv',
    ]);
  });

  it('skips a re-drop of a file already queued', () => {
    const duplicate = file('a.csv');
    const state = reduce(withFiles([duplicate]), {
      type: 'ADD_FILES',
      files: [duplicate, file('b.csv')],
      paymentMonth: '',
    });

    expect(state.items.map((item) => item.file.name)).toEqual([
      'a.csv',
      'b.csv',
    ]);
  });

  it('caps the queue across drops, not just within one', () => {
    const drop = (start: number) =>
      Array.from({ length: 6 }, (_, i) => file(`card-${start + i}.csv`));

    const state = reduce(withFiles(drop(0)), {
      type: 'ADD_FILES',
      files: drop(10),
      paymentMonth: '',
    });

    expect(state.items).toHaveLength(10);
  });

  it('reports what it turned away, so nothing vanishes silently', () => {
    const drop = (start: number) =>
      Array.from({ length: 6 }, (_, i) => file(`card-${start + i}.csv`));
    const duplicate = file('dupe.csv');

    const state = withFiles([...drop(0), duplicate]);

    expect(planAddFiles(state, [...drop(10), duplicate])).toMatchObject({
      rejectedAsDuplicate: 1,
      rejectedAsFull: 3,
    });
    expect(planAddFiles(state, [...drop(10), duplicate]).accepted).toHaveLength(
      3,
    );
  });

  it('reports nothing turned away when the queue has room', () => {
    expect(
      planAddFiles(initialUploadQueueState, [file('a.csv')]),
    ).toMatchObject({ rejectedAsDuplicate: 0, rejectedAsFull: 0 });
  });

  it('ignores a progress update that does not move the bar', () => {
    const queued = reduce(withFiles([file('a.csv')]), {
      type: 'UPLOAD_PROGRESS',
      id: '0',
      progress: 40,
    });
    const same = reduce(queued, {
      type: 'UPLOAD_PROGRESS',
      id: '0',
      progress: 40,
    });

    expect(same.items[0]).toBe(queued.items[0]);
  });

  it('allows re-adding a file whose earlier attempt failed', () => {
    const retried = file('a.csv');
    const state = reduce(
      withFiles([retried]),
      { type: 'ITEM_FAILED', id: '0', error: 'boom' },
      { type: 'ADD_FILES', files: [retried], paymentMonth: '' },
    );

    expect(state.items).toHaveLength(2);
  });

  it('runs an item through the happy path', () => {
    const state = reduce(
      withFiles([file('a.csv')]),
      { type: 'UPLOAD_STARTED', id: '0' },
      { type: 'UPLOAD_PROGRESS', id: '0', progress: 42 },
      { type: 'UPLOAD_SUCCEEDED', id: '0', fileUrl: 'https://s3/a.csv' },
      { type: 'ITEM_SUCCEEDED', id: '0', importId: 'import-1' },
    );

    expect(state.items[0]).toMatchObject({
      status: 'succeeded',
      progress: 100,
      fileUrl: 'https://s3/a.csv',
      importId: 'import-1',
    });
  });

  it('preserves the uploaded fileUrl and clears the error on retry', () => {
    const state = reduce(
      withFiles([file('a.csv')]),
      { type: 'UPLOAD_STARTED', id: '0' },
      { type: 'UPLOAD_SUCCEEDED', id: '0', fileUrl: 'https://s3/a.csv' },
      { type: 'ITEM_FAILED', id: '0', error: 'process failed' },
      { type: 'REQUEUE', ids: ['0'] },
    );

    expect(state.items[0]).toMatchObject({
      status: 'queued',
      progress: 0,
      fileUrl: 'https://s3/a.csv',
      error: undefined,
    });
  });

  it('requeues only the ids it is given', () => {
    const state = reduce(
      withFiles([file('a.csv'), file('b.csv')]),
      { type: 'ITEM_SUCCEEDED', id: '0', importId: 'import-1' },
      { type: 'ITEM_FAILED', id: '1', error: 'boom' },
      { type: 'REQUEUE', ids: ['1'] },
    );

    expect(state.items.map((item) => item.status)).toEqual([
      'succeeded',
      'queued',
    ]);
  });

  it('applies a payment month to every item still in play', () => {
    const state = reduce(
      withFiles([file('a.csv'), file('b.csv')], '01/2024'),
      { type: 'ITEM_SUCCEEDED', id: '0', importId: 'import-1' },
      { type: 'APPLY_PAYMENT_MONTH_TO_ALL', paymentMonth: '02/2024' },
    );

    expect(state.items.map((item) => item.paymentMonth)).toEqual([
      '01/2024',
      '02/2024',
    ]);
  });

  it('edits a single item payment month', () => {
    const state = reduce(withFiles([file('a.csv'), file('b.csv')], '01/2024'), {
      type: 'SET_PAYMENT_MONTH',
      id: '1',
      paymentMonth: '03/2024',
    });

    expect(state.items.map((item) => item.paymentMonth)).toEqual([
      '01/2024',
      '03/2024',
    ]);
  });
});

describe('upload queue selectors', () => {
  it('reports running while any item is uploading or processing', () => {
    const queued = withFiles([file('a.csv')]);
    expect(selectIsRunning(queued)).toBe(false);

    const uploading = reduce(queued, { type: 'UPLOAD_STARTED', id: '0' });
    expect(selectIsRunning(uploading)).toBe(true);

    const processing = reduce(uploading, {
      type: 'UPLOAD_SUCCEEDED',
      id: '0',
      fileUrl: 'https://s3/a.csv',
    });
    expect(selectIsRunning(processing)).toBe(true);
  });

  it('is not drained while one item is still processing', () => {
    const state = reduce(
      withFiles([file('a.csv'), file('b.csv')]),
      { type: 'ITEM_SUCCEEDED', id: '0', importId: 'import-1' },
      { type: 'UPLOAD_STARTED', id: '1' },
      { type: 'UPLOAD_SUCCEEDED', id: '1', fileUrl: 'https://s3/b.csv' },
    );

    expect(selectIsDrained(state)).toBe(false);

    const drained = reduce(state, {
      type: 'ITEM_FAILED',
      id: '1',
      error: 'boom',
    });
    expect(selectIsDrained(drained)).toBe(true);
  });

  it('is not drained when the queue is empty', () => {
    expect(selectIsDrained(initialUploadQueueState)).toBe(false);
  });

  it('returns only queued items to run', () => {
    const state = reduce(withFiles([file('a.csv'), file('b.csv')]), {
      type: 'UPLOAD_STARTED',
      id: '0',
    });

    expect(selectQueuedItems(state).map((item) => item.id)).toEqual(['1']);
  });

  it('summarises the batch with filenames as error ids', () => {
    const state = reduce(
      withFiles([file('a.csv'), file('b.csv')]),
      { type: 'ITEM_SUCCEEDED', id: '0', importId: 'import-1' },
      { type: 'ITEM_FAILED', id: '1', error: 'File is too large' },
    );

    expect(toBatchResult(state)).toEqual({
      total: 2,
      succeeded: 1,
      failed: 1,
      errors: [{ id: 'b.csv', error: 'File is too large' }],
    });
  });
});
