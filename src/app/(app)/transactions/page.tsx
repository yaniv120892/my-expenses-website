'use client';

import { useState } from 'react';
import { Alert, Box, Button } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { format } from 'date-fns';
import {
  Transaction,
  TransactionFilters,
  CreateTransactionInput,
} from '@/types';
import TransactionList from '@/components/TransactionList';
import TransactionForm from '@/components/TransactionForm';
import TransactionListSkeleton from '@/components/TransactionListSkeleton';
import { TransactionFiltersDialog } from '@/components/transactions/TransactionFiltersDialog';
import { TransactionFiltersDisplay } from '@/components/transactions/TransactionFiltersDisplay';
import PendingTransactionsPopup from '@/components/PendingTransactionsPopup';
import IncomeExpensePieChart from '@/components/IncomeExpensePieChart';
import CategoryConfirmationSnackbar from '@/components/CategoryConfirmationSnackbar';
import NotificationSnackbar from '@/components/NotificationSnackbar';
import PageHeader from '@/components/shell/PageHeader';
import {
  useTransactionsQuery,
  useCategoriesQuery,
  useCreateTransactionMutation,
  useUpdateTransactionMutation,
  useDeleteTransactionMutation,
  useTransactionsSummaryQuery,
} from '@/hooks/useTransactionsQuery';
import { CreateTransactionResponse } from '@/services/transactions';
import { defaultMonthFilters } from '@/utils/dateUtils';

export default function TransactionsPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [filtersDialogOpen, setFiltersDialogOpen] = useState(false);
  const [filters, setFilters] = useState<TransactionFilters>(
    defaultMonthFilters(),
  );
  const [error, setError] = useState<string | null>(null);
  const [categoryConfirmation, setCategoryConfirmation] = useState<{
    transactionId: string;
    description: string;
    suggestedCategory: { id: string; name: string };
  } | null>(null);

  const {
    data: transactions = [],
    isLoading: loading,
    isError: loadFailed,
  } = useTransactionsQuery(filters);
  const { data: categories = [] } = useCategoriesQuery();
  const {
    data: summary,
    isLoading: summaryLoading,
    error: summaryError,
  } = useTransactionsSummaryQuery({ ...filters });

  const createMutation = useCreateTransactionMutation();
  const updateMutation = useUpdateTransactionMutation();
  const deleteMutation = useDeleteTransactionMutation();

  const handleEdit = (tx: Transaction) => {
    setEditTx(tx);
    setFormOpen(true);
  };

  // Submit and form-delete errors are surfaced by TransactionForm itself, so
  // these handlers must let failures propagate — catching here made the form
  // report success on a failed save.
  const handleCreate = async (data: CreateTransactionInput) => {
    const result: CreateTransactionResponse =
      await createMutation.mutateAsync(data);
    if (result.suggestedCategory) {
      setCategoryConfirmation({
        transactionId: result.id,
        description: data.description,
        suggestedCategory: result.suggestedCategory,
      });
    }
    return result.id;
  };

  const handleUpdate = async (id: string, data: CreateTransactionInput) => {
    await updateMutation.mutateAsync({ id, data });
  };

  const deleteTransaction = async (id: string) => {
    await deleteMutation.mutateAsync(id);
  };

  // The list has no error surface of its own, so its deletes are caught here.
  const handleDeleteFromList = async (id: string) => {
    try {
      await deleteTransaction(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete transaction');
    }
  };

  return (
    <>
      <PageHeader
        title="Transactions"
        action={
          <Button
            variant="contained"
            startIcon={<AddRoundedIcon />}
            onClick={() => {
              setEditTx(null);
              setFormOpen(true);
            }}
          >
            Add transaction
          </Button>
        }
      />

      <PendingTransactionsPopup />

      <IncomeExpensePieChart
        income={summary?.totalIncome || 0}
        expense={summary?.totalExpense || 0}
        loading={summaryLoading}
        error={summaryError as string | null}
        title={
          filters.startDate
            ? format(new Date(filters.startDate), 'MMMM yyyy')
            : ''
        }
      />

      <TransactionFiltersDisplay
        {...filters}
        onOpenFilters={() => setFiltersDialogOpen(true)}
        categories={categories}
        onResetSearch={() =>
          setFilters((prev) => ({ ...prev, searchTerm: undefined }))
        }
        onResetCategory={() =>
          setFilters((prev) => ({ ...prev, categoryId: undefined }))
        }
        onResetDateRange={() =>
          setFilters((prev) => ({
            ...prev,
            startDate: undefined,
            endDate: undefined,
          }))
        }
      />

      <Box sx={{ mt: 2 }}>
        {loading ? (
          <TransactionListSkeleton rows={6} />
        ) : loadFailed ? (
          <Alert severity="error">
            Failed to load transactions. Please try again.
          </Alert>
        ) : (
          <TransactionList
            transactions={transactions}
            onEditAction={handleEdit}
            onDeleteAction={handleDeleteFromList}
          />
        )}
      </Box>

      <TransactionForm
        open={formOpen}
        onCloseAction={() => {
          setFormOpen(false);
          setEditTx(null);
        }}
        onSubmitAction={
          editTx ? (data) => handleUpdate(editTx.id, data) : handleCreate
        }
        onDeleteAction={deleteTransaction}
        initialData={
          editTx
            ? {
                id: editTx.id,
                description: editTx.description,
                value: editTx.value,
                categoryId: editTx.category.id,
                type: editTx.type,
                date: editTx.date,
              }
            : null
        }
      />

      <TransactionFiltersDialog
        open={filtersDialogOpen}
        onClose={() => setFiltersDialogOpen(false)}
        onApply={setFilters}
        initialFilters={filters}
      />

      {categoryConfirmation && (
        <CategoryConfirmationSnackbar
          open={!!categoryConfirmation}
          transactionId={categoryConfirmation.transactionId}
          description={categoryConfirmation.description}
          suggestedCategory={categoryConfirmation.suggestedCategory}
          onClose={() => setCategoryConfirmation(null)}
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
