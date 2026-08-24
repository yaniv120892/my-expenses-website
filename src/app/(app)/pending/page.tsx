'use client';

import { useState } from 'react';
import { Alert } from '@mui/material';
import PendingTransactionsList from '@/components/PendingTransactionsList';
import PendingTransactionListSkeleton from '@/components/PendingTransactionListSkeleton';
import NotificationSnackbar from '@/components/NotificationSnackbar';
import PageHeader from '@/components/shell/PageHeader';
import {
  usePendingTransactionsQuery,
  useConfirmTransactionMutation,
  useDeletePendingTransactionMutation,
} from '@/hooks/usePendingTransactionsQuery';

type Notice = { message: string; severity: 'success' | 'error' };

export default function PendingPage() {
  const [notice, setNotice] = useState<Notice | null>(null);
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
      setNotice({ message: successMessage, severity: 'success' });
    } catch (error) {
      setNotice({
        message: error instanceof Error ? error.message : failureMessage,
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
        open={!!notice}
        message={notice?.message ?? ''}
        severity={notice?.severity}
        onClose={() => setNotice(null)}
      />
    </>
  );
}
