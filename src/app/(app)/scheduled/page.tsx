'use client';

import { useState } from 'react';
import { Alert, Button } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ScheduledTransactionList from '@/components/ScheduledTransactionList';
import ScheduledTransactionForm from '@/components/ScheduledTransactionForm';
import ScheduledTransactionListSkeleton from '@/components/ScheduledTransactionListSkeleton';
import { PageHeader } from '@yaniv120892/my-ui';
import { CreateScheduledTransactionInput, ScheduledTransaction } from '@/types';
import {
  useScheduledTransactionsQuery,
  useCreateScheduledTransactionMutation,
  useUpdateScheduledTransactionMutation,
  useDeleteScheduledTransactionMutation,
} from '@/hooks/useScheduledTransactionsQuery';
import { useCategoriesQuery } from '@/hooks/useTransactionsQuery';
import { useT } from '@/i18n/useT';

export default function ScheduledPage() {
  const t = useT();
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

  // Must not catch: the form reports the outcome (see CLAUDE.md).
  async function handleFormSubmit(data: CreateScheduledTransactionInput) {
    if (editTx) {
      await updateMutation.mutateAsync({ id: editTx.id, data });
      return;
    }
    await createMutation.mutateAsync(data);
  }

  return (
    <>
      <PageHeader
        title={t('scheduled.title')}
        subtitle={t('scheduled.subtitle')}
        actions={
          <Button
            variant="contained"
            startIcon={<AddRoundedIcon />}
            onClick={() => {
              setEditTx(null);
              setFormOpen(true);
            }}
          >
            {t('scheduled.add')}
          </Button>
        }
      />

      {loading ? (
        <ScheduledTransactionListSkeleton rows={6} />
      ) : loadFailed ? (
        <Alert severity="error">{t('scheduled.loadFailed')}</Alert>
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
        onDeleteAction={deleteMutation.mutateAsync}
        initialData={editTx}
      />
    </>
  );
}
