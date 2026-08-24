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

  async function handleConfirm(id: string) {
    try {
      await confirmMutation.mutateAsync(id);
      setNotice({
        message: 'Transaction approved successfully',
        severity: 'success',
      });
    } catch (e) {
      setNotice({
        message:
          e instanceof Error ? e.message : 'Failed to confirm transaction',
        severity: 'error',
      });
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteMutation.mutateAsync(id);
      setNotice({
        message: 'Transaction rejected successfully',
        severity: 'success',
      });
    } catch (e) {
      setNotice({
        message:
          e instanceof Error ? e.message : 'Failed to delete transaction',
        severity: 'error',
      });
    }
  }

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
        severity={notice?.severity ?? 'success'}
        onClose={() => setNotice(null)}
      />
    </>
  );
}
