'use client';

import { useCallback, useEffect, useReducer, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { importService } from '@/services/importService';
import { importKeys } from '@/hooks/useImports';
import { BatchResult } from '@/types/import';
import {
  initialUploadQueueState,
  MAX_CONCURRENT_UPLOADS,
  selectFailedItems,
  selectIsDrained,
  selectIsRunning,
  selectQueuedItems,
  toBatchResult,
  toQueuedItem,
  uploadQueueReducer,
  UploadItem,
} from '@/utils/importUploadQueue';
import { runUploadBatch, UploadRunnerApi } from '@/utils/importUploadRunner';

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

export function useMultiFileImport({
  onAllSucceeded,
}: UseMultiFileImportOptions = {}): UseMultiFileImportResult {
  const [state, dispatch] = useReducer(
    uploadQueueReducer,
    initialUploadQueueState,
  );
  const queryClient = useQueryClient();

  // A retry dispatches and starts its batch in the same tick, before the
  // state-derived flag would have re-rendered.
  const isRunningRef = useRef(false);
  const notifiedRef = useRef(false);

  const isDrained = selectIsDrained(state);
  const summary = isDrained ? toBatchResult(state) : null;

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

  // Completion is decided from the whole queue, not the batch: retrying one of
  // several failed rows must not report success while the others are still red.
  useEffect(() => {
    if (!isDrained || notifiedRef.current) return;
    if (selectFailedItems(state).length > 0) return;

    notifiedRef.current = true;
    onAllSucceeded?.();
  }, [isDrained, onAllSucceeded, state]);

  const requeueAndRun = useCallback(
    (items: UploadItem[]) => {
      if (items.length === 0) return;

      dispatch({ type: 'REQUEUE', ids: items.map((item) => item.id) });
      void runBatch(items.map(toQueuedItem));
    },
    [runBatch],
  );

  const start = useCallback(() => {
    void runBatch(selectQueuedItems(state));
  }, [runBatch, state]);

  const retryItem = useCallback(
    (id: string) => {
      requeueAndRun(selectFailedItems(state).filter((item) => item.id === id));
    },
    [requeueAndRun, state],
  );

  const retryAllFailed = useCallback(() => {
    requeueAndRun(selectFailedItems(state));
  }, [requeueAndRun, state]);

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
    hasFailures: selectFailedItems(state).length > 0,
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
