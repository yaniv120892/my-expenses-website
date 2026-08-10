'use client';

import { useState } from 'react';
import PendingTransactionsList from '@/components/PendingTransactionsList';
import PendingTransactionListSkeleton from '@/components/PendingTransactionListSkeleton';
import NotificationSnackbar from '@/components/NotificationSnackbar';
import PageHeader from '@/components/shell/PageHeader';
import {
  usePendingTransactionsQuery,
  useConfirmTransactionMutation,
  useDeletePendingTransactionMutation,
} from '@/hooks/usePendingTransactionsQuery';

export default function PendingPage() {
  const [error, setError] = useState<string | null>(null);
  const { data: pendingTransactions = [], isLoading } =
    usePendingTransactionsQuery();
  const confirmMutation = useConfirmTransactionMutation();
  const deleteMutation = useDeletePendingTransactionMutation();

  async function handleConfirm(id: string) {
    try {
      await confirmMutation.mutateAsync(id);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Failed to confirm transaction',
      );
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteMutation.mutateAsync(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete transaction');
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
      ) : (
        <PendingTransactionsList
          transactions={pendingTransactions}
          onConfirmAction={handleConfirm}
          onDeleteAction={handleDelete}
        />
      )}
      <NotificationSnackbar
        open={!!error}
        message={error ?? ''}
        severity="error"
        onClose={() => setError(null)}
      />
    </>
  );
}
