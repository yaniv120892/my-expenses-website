'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { importService } from '@/services/importService';
import { importKeys } from '@/hooks/useImports';
import { BatchResult } from '@/types/import';
import {
  initialUploadQueueState,
  selectIsDrained,
  selectIsRunning,
  selectQueuedItems,
  toBatchResult,
  uploadQueueReducer,
  UploadItem,
} from '@/components/FileUpload/uploadQueueReducer';
import {
  runUploadBatch,
  UploadRunnerApi,
} from '@/components/FileUpload/uploadRunner';

// Two at a time overlaps one file's extraction submit with the next file's
// upload without splitting the uplink far enough to push either toward the
// 120s upload timeout.
export const MAX_CONCURRENT_UPLOADS = 2;
export const MAX_FILES_PER_BATCH = 10;

interface UseMultiFileImportOptions {
  onAllSucceeded?: () => void;
}

export interface UseMultiFileImportResult {
  items: UploadItem[];
  isRunning: boolean;
  summary: BatchResult | null;
  hasFailures: boolean;
  queuedCount: number;
  addFiles: (files: File[], paymentMonth: string) => void;
  removeItem: (id: string) => void;
  setPaymentMonth: (id: string, paymentMonth: string) => void;
  applyPaymentMonthToAll: (paymentMonth: string) => void;
  start: () => void;
  retryItem: (id: string) => void;
  retryAllFailed: () => void;
  reset: () => void;
}

const uploadRunnerApi: UploadRunnerApi = {
  uploadImportFile: (formData, onProgress) =>
    importService.uploadImportFile(formData, onProgress),
  processImport: (fileUrl, originalFileName, paymentMonth) =>
    importService.processImport(fileUrl, originalFileName, paymentMonth),
};

function requeue(item: UploadItem): UploadItem {
  return { ...item, status: 'queued', progress: 0, error: undefined };
}

export function useMultiFileImport({
  onAllSucceeded,
}: UseMultiFileImportOptions = {}): UseMultiFileImportResult {
  const [state, dispatch] = useReducer(
    uploadQueueReducer,
    initialUploadQueueState,
  );
  const queryClient = useQueryClient();

  const isRunningRef = useRef(false);
  const notifiedRef = useRef(false);

  const isDrained = selectIsDrained(state);
  const summary = useMemo(
    () => (isDrained ? toBatchResult(state) : null),
    [isDrained, state],
  );

  /**
   * The batch is passed in rather than read back from state: a dispatch made
   * by the caller has not been rendered yet when this runs.
   */
  const runBatch = useCallback(
    async (batch: UploadItem[]) => {
      if (isRunningRef.current || batch.length === 0) return;

      isRunningRef.current = true;
      notifiedRef.current = false;

      try {
        await runUploadBatch(
          batch,
          uploadRunnerApi,
          dispatch,
          MAX_CONCURRENT_UPLOADS,
        );
      } finally {
        isRunningRef.current = false;
        // One refetch for the whole batch, rather than one per file.
        queryClient.invalidateQueries({ queryKey: importKeys.lists() });
      }
    },
    [queryClient],
  );

  useEffect(() => {
    if (!isDrained || notifiedRef.current) return;
    if (state.items.some((item) => item.status === 'failed')) return;

    notifiedRef.current = true;
    onAllSucceeded?.();
  }, [isDrained, onAllSucceeded, state.items]);

  const start = useCallback(() => {
    void runBatch(selectQueuedItems(state));
  }, [runBatch, state]);

  const retryItem = useCallback(
    (id: string) => {
      const failed = state.items.find(
        (item) => item.id === id && item.status === 'failed',
      );
      if (!failed) return;

      dispatch({ type: 'RETRY_ITEM', id });
      void runBatch([requeue(failed)]);
    },
    [runBatch, state.items],
  );

  const retryAllFailed = useCallback(() => {
    const failed = state.items.filter((item) => item.status === 'failed');
    if (failed.length === 0) return;

    dispatch({ type: 'RETRY_ALL_FAILED' });
    void runBatch(failed.map(requeue));
  }, [runBatch, state.items]);

  const addFiles = useCallback((files: File[], paymentMonth: string) => {
    dispatch({ type: 'ADD_FILES', files, paymentMonth });
  }, []);

  const removeItem = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_ITEM', id });
  }, []);

  const setPaymentMonth = useCallback((id: string, paymentMonth: string) => {
    dispatch({ type: 'SET_PAYMENT_MONTH', id, paymentMonth });
  }, []);

  const applyPaymentMonthToAll = useCallback((paymentMonth: string) => {
    dispatch({ type: 'APPLY_PAYMENT_MONTH_TO_ALL', paymentMonth });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  return {
    items: state.items,
    isRunning: selectIsRunning(state),
    summary,
    hasFailures: state.items.some((item) => item.status === 'failed'),
    queuedCount: selectQueuedItems(state).length,
    addFiles,
    removeItem,
    setPaymentMonth,
    applyPaymentMonthToAll,
    start,
    retryItem,
    retryAllFailed,
    reset,
  };
}
