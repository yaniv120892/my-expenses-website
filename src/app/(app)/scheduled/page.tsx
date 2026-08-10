'use client';

import { useState } from 'react';
import { Button } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ScheduledTransactionList from '@/components/ScheduledTransactionList';
import ScheduledTransactionForm from '@/components/ScheduledTransactionForm';
import ScheduledTransactionListSkeleton from '@/components/ScheduledTransactionListSkeleton';
import NotificationSnackbar from '@/components/NotificationSnackbar';
import PageHeader from '@/components/shell/PageHeader';
import {
  CreateScheduledTransactionInput,
  ScheduledTransaction,
  UpdateScheduledTransactionInput,
} from '@/types';
import {
  useScheduledTransactionsQuery,
  useCreateScheduledTransactionMutation,
  useUpdateScheduledTransactionMutation,
  useDeleteScheduledTransactionMutation,
} from '@/hooks/useScheduledTransactionsQuery';
import { useCategoriesQuery } from '@/hooks/useTransactionsQuery';

export default function ScheduledPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [editTx, setEditTx] = useState<ScheduledTransaction | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: scheduledTransactions = [], isLoading: loading } =
    useScheduledTransactionsQuery();
  const { data: categories = [] } = useCategoriesQuery();

  const createMutation = useCreateScheduledTransactionMutation();
  const updateMutation = useUpdateScheduledTransactionMutation();
  const deleteMutation = useDeleteScheduledTransactionMutation();

  async function handleFormSubmit(
    data: CreateScheduledTransactionInput | UpdateScheduledTransactionInput,
  ) {
    try {
      if (editTx) {
        await updateMutation.mutateAsync({ id: editTx.id, data });
      } else {
        await createMutation.mutateAsync(
          data as CreateScheduledTransactionInput,
        );
      }
      setFormOpen(false);
      setEditTx(null);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Failed to save scheduled transaction',
      );
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteMutation.mutateAsync(id);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Failed to delete scheduled transaction',
      );
    }
  }

  return (
    <>
      <PageHeader
        title="Scheduled"
        subtitle="Recurring transactions created automatically on schedule"
        action={
          <Button
            variant="contained"
            startIcon={<AddRoundedIcon />}
            onClick={() => {
              setEditTx(null);
              setFormOpen(true);
            }}
          >
            Add scheduled
          </Button>
        }
      />

      {loading ? (
        <ScheduledTransactionListSkeleton rows={6} />
      ) : (
        <ScheduledTransactionList
          scheduledTransactions={scheduledTransactions}
          categories={categories}
          onEditAction={(tx) => {
            setEditTx(tx);
            setFormOpen(true);
          }}
        />
      )}

      <ScheduledTransactionForm
        open={formOpen}
        onCloseAction={() => {
          setFormOpen(false);
          setEditTx(null);
        }}
        onSubmitAction={handleFormSubmit}
        onDeleteAction={handleDelete}
        initialData={editTx}
      />

      <NotificationSnackbar
        open={!!error}
        message={error ?? ''}
        severity="error"
        onClose={() => setError(null)}
      />
    </>
  );
}
