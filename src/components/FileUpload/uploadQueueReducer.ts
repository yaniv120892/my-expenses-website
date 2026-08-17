import { BatchResult } from '@/types/import';

export type UploadItemStatus =
  'queued' | 'uploading' | 'processing' | 'succeeded' | 'failed';

export interface UploadItem {
  id: string;
  file: File;
  paymentMonth: string;
  status: UploadItemStatus;
  progress: number;
  /** Set once the S3 put succeeds, so a retry does not re-send the body. */
  fileUrl?: string;
  importId?: string;
  error?: string;
}

export interface UploadQueueState {
  items: UploadItem[];
  nextSeq: number;
}

export type UploadQueueAction =
  | { type: 'ADD_FILES'; files: File[]; paymentMonth: string }
  | { type: 'REMOVE_ITEM'; id: string }
  | { type: 'SET_PAYMENT_MONTH'; id: string; paymentMonth: string }
  | { type: 'APPLY_PAYMENT_MONTH_TO_ALL'; paymentMonth: string }
  | { type: 'UPLOAD_STARTED'; id: string }
  | { type: 'UPLOAD_PROGRESS'; id: string; progress: number }
  | { type: 'UPLOAD_SUCCEEDED'; id: string; fileUrl: string }
  | { type: 'ITEM_SUCCEEDED'; id: string; importId: string }
  | { type: 'ITEM_FAILED'; id: string; error: string }
  | { type: 'RETRY_ITEM'; id: string }
  | { type: 'RETRY_ALL_FAILED' }
  | { type: 'RESET' };

export const initialUploadQueueState: UploadQueueState = {
  items: [],
  nextSeq: 0,
};

const TERMINAL_STATUSES: UploadItemStatus[] = ['succeeded', 'failed'];

function isSameFile(a: File, b: File): boolean {
  return (
    a.name === b.name && a.size === b.size && a.lastModified === b.lastModified
  );
}

function toQueuedItem(item: UploadItem): UploadItem {
  return {
    ...item,
    status: 'queued',
    progress: 0,
    error: undefined,
  };
}

function mapItem(
  state: UploadQueueState,
  id: string,
  update: (item: UploadItem) => UploadItem,
): UploadQueueState {
  return {
    ...state,
    items: state.items.map((item) => (item.id === id ? update(item) : item)),
  };
}

export function uploadQueueReducer(
  state: UploadQueueState,
  action: UploadQueueAction,
): UploadQueueState {
  switch (action.type) {
    case 'ADD_FILES': {
      // A re-drop of a file already queued would otherwise create a second
      // import for the same statement.
      const added = action.files.filter(
        (file) =>
          !state.items.some(
            (item) => item.status !== 'failed' && isSameFile(item.file, file),
          ),
      );

      return {
        items: [
          ...state.items,
          ...added.map((file, index) => ({
            id: String(state.nextSeq + index),
            file,
            paymentMonth: action.paymentMonth,
            status: 'queued' as const,
            progress: 0,
          })),
        ],
        nextSeq: state.nextSeq + added.length,
      };
    }

    case 'REMOVE_ITEM':
      return {
        ...state,
        items: state.items.filter((item) => item.id !== action.id),
      };

    case 'SET_PAYMENT_MONTH':
      return mapItem(state, action.id, (item) => ({
        ...item,
        paymentMonth: action.paymentMonth,
      }));

    case 'APPLY_PAYMENT_MONTH_TO_ALL':
      return {
        ...state,
        items: state.items.map((item) =>
          TERMINAL_STATUSES.includes(item.status)
            ? item
            : { ...item, paymentMonth: action.paymentMonth },
        ),
      };

    case 'UPLOAD_STARTED':
      return mapItem(state, action.id, (item) => ({
        ...item,
        status: 'uploading',
        progress: 0,
        error: undefined,
      }));

    case 'UPLOAD_PROGRESS':
      return mapItem(state, action.id, (item) => ({
        ...item,
        progress: action.progress,
      }));

    case 'UPLOAD_SUCCEEDED':
      return mapItem(state, action.id, (item) => ({
        ...item,
        status: 'processing',
        progress: 100,
        fileUrl: action.fileUrl,
      }));

    case 'ITEM_SUCCEEDED':
      return mapItem(state, action.id, (item) => ({
        ...item,
        status: 'succeeded',
        progress: 100,
        importId: action.importId,
      }));

    case 'ITEM_FAILED':
      return mapItem(state, action.id, (item) => ({
        ...item,
        status: 'failed',
        error: action.error,
      }));

    case 'RETRY_ITEM':
      return mapItem(state, action.id, toQueuedItem);

    case 'RETRY_ALL_FAILED':
      return {
        ...state,
        items: state.items.map((item) =>
          item.status === 'failed' ? toQueuedItem(item) : item,
        ),
      };

    case 'RESET':
      return initialUploadQueueState;
  }
}

export function selectIsRunning(state: UploadQueueState): boolean {
  return state.items.some(
    (item) => item.status === 'uploading' || item.status === 'processing',
  );
}

export function selectQueuedItems(state: UploadQueueState): UploadItem[] {
  return state.items.filter((item) => item.status === 'queued');
}

export function selectIsDrained(state: UploadQueueState): boolean {
  return (
    state.items.length > 0 &&
    state.items.every((item) => TERMINAL_STATUSES.includes(item.status))
  );
}

export function toBatchResult(state: UploadQueueState): BatchResult {
  const failed = state.items.filter((item) => item.status === 'failed');

  return {
    total: state.items.length,
    succeeded: state.items.filter((item) => item.status === 'succeeded').length,
    failed: failed.length,
    errors: failed.map((item) => ({
      id: item.file.name,
      error: item.error ?? 'Upload failed',
    })),
  };
}
