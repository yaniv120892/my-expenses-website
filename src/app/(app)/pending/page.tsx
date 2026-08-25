'use client';

import { useState } from 'react';
import { Alert } from '@mui/material';
import PendingTransactionsList from '@/components/PendingTransactionsList';
import PendingTransactionListSkeleton from '@/components/PendingTransactionListSkeleton';
import NotificationSnackbar from '@/components/NotificationSnackbar';
import PageHeader from '@/components/shell/PageHeader';
import { handleApiError } from '@/utils/api';
import {
  usePendingTransactionsQuery,
  useConfirmTransactionMutation,
  useDeletePendingTransactionMutation,
} from '@/hooks/usePendingTransactionsQuery';

type Notice = { message: string; severity: 'success' | 'error' };

function isAxiosGenericMessage(message: string): boolean {
  return (
    message === 'Network Error' ||
    message.startsWith('Request failed with status code') ||
    message.startsWith('timeout of ')
  );
}

export default function PendingPage() {
  const [notice, setNotice] = useState<Notice | null>(null);
  const [noticeOpen, setNoticeOpen] = useState(false);
  // Remounts the snackbar per notice, restarting its auto-hide timer and
  // entry animation for rapid consecutive outcomes.
  const [noticeKey, setNoticeKey] = useState(0);

  function showNotice(next: Notice) {
    setNotice(next);
    setNoticeOpen(true);
    setNoticeKey((key) => key + 1);
  }
  const {
    data: pendingTransactions = [],
    isLoading,
    isError: loadFailed,
  } = usePendingTransactionsQuery();
  const confirmMutation = useConfirmTransactionMutation();
  const deleteMutation = useDeletePendingTransactionMutation();

  async function runWithNotice(
    action: () => Promise<unknown>,
    successMessage: string,
    failureMessage: string,
  ) {
    try {
      await action();
      showNotice({ message: successMessage, severity: 'success' });
    } catch (error) {
      // Axios's own messages ("Network Error") are not user-facing; only a
      // server-provided message beats the friendly fallback.
      const message = handleApiError(error, failureMessage);
      showNotice({
        message: isAxiosGenericMessage(message) ? failureMessage : message,
        severity: 'error',
      });
    }
  }

  const handleConfirm = (id: string) =>
    runWithNotice(
      () => confirmMutation.mutateAsync(id),
      'Transaction approved successfully',
      'Failed to confirm transaction',
    );

  const handleDelete = (id: string) =>
    runWithNotice(
      () => deleteMutation.mutateAsync(id),
      'Transaction rejected successfully',
      'Failed to delete transaction',
    );

  return (
    <>
      <PageHeader
        title="Pending"
        subtitle="Transactions waiting for your approval"
      />
      {isLoading ? (
        <PendingTransactionListSkeleton rows={6} />
      ) : loadFailed ? (
        <Alert severity="error">
          Failed to load pending transactions. Please try again.
        </Alert>
      ) : (
        <PendingTransactionsList
          transactions={pendingTransactions}
          onConfirmAction={handleConfirm}
          onDeleteAction={handleDelete}
        />
      )}
      <NotificationSnackbar
        key={noticeKey}
        open={noticeOpen}
        message={notice?.message ?? ''}
        severity={notice?.severity}
        onClose={() => setNoticeOpen(false)}
      />
    </>
  );
}
