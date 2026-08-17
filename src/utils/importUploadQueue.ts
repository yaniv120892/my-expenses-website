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
  | { type: 'REQUEUE'; ids: string[] }
  | { type: 'RESET' };

// Two at a time overlaps one file's extraction submit with the next file's
// upload without splitting the uplink far enough to push either toward the
// 120s upload timeout.
export const MAX_CONCURRENT_UPLOADS = 2;
export const MAX_FILES_PER_BATCH = 10;

export const initialUploadQueueState: UploadQueueState = {
  items: [],
  nextSeq: 0,
};

/** A row that has settled: nothing further will happen to it on its own. */
export function isTerminal(status: UploadItemStatus): boolean {
  return status === 'succeeded' || status === 'failed';
}

function isSameFile(a: File, b: File): boolean {
  return (
    a.name === b.name && a.size === b.size && a.lastModified === b.lastModified
  );
}

/**
 * Which of `files` the queue will take. Shared with the reducer so the caller
 * can tell the user what was turned away instead of watching files vanish.
 */
export function planAddFiles(
  state: UploadQueueState,
  files: File[],
): { accepted: File[]; rejectedAsDuplicate: number; rejectedAsFull: number } {
  // A re-drop of a file already queued would otherwise create a second import
  // for the same statement.
  const fresh = files.filter(
    (file) =>
      !state.items.some(
        (item) => item.status !== 'failed' && isSameFile(item.file, file),
      ),
  );
  // The cap is the queue's, not one drop's: several drops must not add up
  // past it.
  const room = Math.max(0, MAX_FILES_PER_BATCH - state.items.length);
  const accepted = fresh.slice(0, room);

  return {
    accepted,
    rejectedAsDuplicate: files.length - fresh.length,
    rejectedAsFull: fresh.length - accepted.length,
  };
}

export function toQueuedItem(item: UploadItem): UploadItem {
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
      const { accepted: added } = planAddFiles(state, action.files);

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
          isTerminal(item.status)
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
      return mapItem(state, action.id, (item) =>
        item.progress === action.progress
          ? item
          : { ...item, progress: action.progress },
      );

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

    case 'REQUEUE':
      return {
        ...state,
        items: state.items.map((item) =>
          action.ids.includes(item.id) ? toQueuedItem(item) : item,
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

export function selectFailedItems(state: UploadQueueState): UploadItem[] {
  return state.items.filter((item) => item.status === 'failed');
}

export function selectIsDrained(state: UploadQueueState): boolean {
  return (
    state.items.length > 0 &&
    state.items.every((item) => isTerminal(item.status))
  );
}

export function toBatchResult(state: UploadQueueState): BatchResult {
  const failed = selectFailedItems(state);

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
