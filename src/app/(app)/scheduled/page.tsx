'use client';

import { useState } from 'react';
import { Alert, Button } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ScheduledTransactionList from '@/components/ScheduledTransactionList';
import ScheduledTransactionForm from '@/components/ScheduledTransactionForm';
import ScheduledTransactionListSkeleton from '@/components/ScheduledTransactionListSkeleton';
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

  const {
    data: scheduledTransactions = [],
    isLoading: loading,
    isError: loadFailed,
  } = useScheduledTransactionsQuery();
  const { data: categories = [] } = useCategoriesQuery();

  const createMutation = useCreateScheduledTransactionMutation();
  const updateMutation = useUpdateScheduledTransactionMutation();
  const deleteMutation = useDeleteScheduledTransactionMutation();

  // Neither may catch: see the form-submit invariant in CLAUDE.md.
  async function handleFormSubmit(
    data: CreateScheduledTransactionInput | UpdateScheduledTransactionInput,
  ) {
    if (editTx) {
      await updateMutation.mutateAsync({ id: editTx.id, data });
      return;
    }
    await createMutation.mutateAsync(data as CreateScheduledTransactionInput);
  }

  async function handleDelete(id: string) {
    await deleteMutation.mutateAsync(id);
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
      ) : loadFailed ? (
        <Alert severity="error">
          Failed to load scheduled transactions. Please try again.
        </Alert>
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
    </>
  );
}
