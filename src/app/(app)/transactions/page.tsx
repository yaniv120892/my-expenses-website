'use client';

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import { format } from 'date-fns';
import {
  Transaction,
  TransactionFilters,
  TransactionType,
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
import InfiniteScrollSentinel from '@/components/InfiniteScrollSentinel';
import {
  useTransactionsInfiniteQuery,
  useCategoriesQuery,
  useCreateTransactionMutation,
  useUpdateTransactionMutation,
  useDeleteTransactionMutation,
  useTransactionsSummaryQuery,
  useExportTransactionsCsvMutation,
} from '@/hooks/useTransactionsQuery';
import { CreateTransactionResponse } from '@/services/transactions';
import { defaultMonthFilters } from '@/utils/dateUtils';

function parseTransactionType(
  value: string | null,
): TransactionType | undefined {
  return value === 'INCOME' || value === 'EXPENSE' ? value : undefined;
}

function TransactionsPageContent() {
  // Read once to seed the filters: the drill-down from the dashboard pie arrives
  // as query params, but the page owns its filters from then on.
  const searchParams = useSearchParams();
  const [formOpen, setFormOpen] = useState(false);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [filtersDialogOpen, setFiltersDialogOpen] = useState(false);
  const [filters, setFilters] = useState<TransactionFilters>(() => ({
    ...defaultMonthFilters(),
    categoryId: searchParams.get('categoryId') ?? undefined,
    type: parseTransactionType(searchParams.get('type')),
  }));
  const [error, setError] = useState<string | null>(null);
  const [categoryConfirmation, setCategoryConfirmation] = useState<{
    transactionId: string;
    description: string;
    suggestedCategory: { id: string; name: string };
  } | null>(null);

  const {
    data,
    isLoading: loading,
    isError: loadFailed,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useTransactionsInfiniteQuery(filters);
  const transactions = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data],
  );
  const { data: categories = [] } = useCategoriesQuery();
  const { data: summary } = useTransactionsSummaryQuery(filters);
  // The chart drives the type filter, so it must ignore it: filtering the chart
  // by its own selection would zero the slice the user has to click to go back.
  const {
    data: chartSummary,
    isLoading: chartSummaryLoading,
    error: chartSummaryError,
  } = useTransactionsSummaryQuery({ ...filters, type: undefined });

  const createMutation = useCreateTransactionMutation();
  const updateMutation = useUpdateTransactionMutation();
  const deleteMutation = useDeleteTransactionMutation();
  const exportMutation = useExportTransactionsCsvMutation();

  const handleExport = async () => {
    try {
      await exportMutation.mutateAsync(filters);
    } catch {
      // The response is a blob, so the server's message is not readable here.
      setError('Failed to export transactions');
    }
  };

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
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={
                exportMutation.isPending ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <DownloadRoundedIcon />
                )
              }
              disabled={exportMutation.isPending}
              onClick={handleExport}
            >
              Export CSV
            </Button>
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
          </Stack>
        }
      />

      <PendingTransactionsPopup />

      <IncomeExpensePieChart
        income={chartSummary?.totalIncome || 0}
        expense={chartSummary?.totalExpense || 0}
        loading={chartSummaryLoading}
        error={chartSummaryError as string | null}
        selectedType={filters.type ?? null}
        onSelectType={(type) =>
          setFilters((prev) => ({
            ...prev,
            type: prev.type === type ? undefined : type,
          }))
        }
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
        onResetType={() => setFilters((prev) => ({ ...prev, type: undefined }))}
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
          <>
            {summary && summary.count > 0 && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mb: 1 }}
              >
                {`Showing ${transactions.length} of ${summary.count}`}
              </Typography>
            )}
            <TransactionList
              transactions={transactions}
              onEditAction={handleEdit}
              onDeleteAction={handleDeleteFromList}
            />
            <InfiniteScrollSentinel
              hasMore={hasNextPage}
              loading={isFetchingNextPage}
              onLoadMore={fetchNextPage}
            />
          </>
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
        // Merged rather than replaced: the dialog has no type control, so a
        // replace would silently drop a type picked on the chart.
        onApply={(next) => setFilters((prev) => ({ ...prev, ...next }))}
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

export default function TransactionsPage() {
  return (
    <Suspense fallback={<TransactionListSkeleton rows={6} />}>
      <TransactionsPageContent />
    </Suspense>
  );
}
