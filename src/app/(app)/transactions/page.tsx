'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import type { Transaction, TransactionFilters, CreateTransactionInput } from '@/types';
import {
  DEFAULT_TRANSACTION_SORT,
  transactionFilterSchema,
  type TransactionSort,
} from '@/shared/schemas/transactions';
import TransactionList from '@/components/TransactionList';
import TransactionForm from '@/components/TransactionForm';
import TransactionListSkeleton from '@/components/TransactionListSkeleton';
import { TransactionFiltersDialog } from '@/components/transactions/TransactionFiltersDialog';
import { TransactionFiltersDisplay } from '@/components/transactions/TransactionFiltersDisplay';
import { TransactionSortSelect } from '@/components/transactions/TransactionSortSelect';
import PendingTransactionsPopup from '@/components/PendingTransactionsPopup';
import IncomeExpensePieChart from '@/components/IncomeExpensePieChart';
import CategoryBreakdownPieChart from '@/components/CategoryBreakdownPieChart';
import CategoryConfirmationSnackbar from '@/components/CategoryConfirmationSnackbar';
import NotificationSnackbar from '@/components/NotificationSnackbar';
import { PageHeader } from '@yaniv120892/my-ui';
import { useCanWrite } from '@/hooks/useSession';
import InfiniteScrollSentinel from '@/components/InfiniteScrollSentinel';
import {
  useTransactionsInfiniteQuery,
  useCategoriesQuery,
  useCreateTransactionMutation,
  useUpdateTransactionMutation,
  useDeleteTransactionMutation,
  useTransactionsSummaryQuery,
  useExportTransactionsCsvMutation,
  useCategoryBreakdownQuery,
} from '@/hooks/useTransactionsQuery';
import type { CreateTransactionResponse } from '@/services/transactions';
import { defaultDateRange, describeDateRange } from '@/utils/dateRangePresets';
import { useAppFormat } from '@/i18n/useAppFormat';
import { describeApiError } from '@/utils/api';
import { useT } from '@/i18n/useT';

const filterShape = transactionFilterSchema.shape;

function TransactionsPageContent() {
  // Read once to seed the filters: the drill-down from the dashboard pie arrives
  // as query params, but the page owns its filters from then on.
  const searchParams = useSearchParams();
  const t = useT();
  const canWrite = useCanWrite();
  const formatter = useAppFormat();
  const [formOpen, setFormOpen] = useState(false);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [filtersDialogOpen, setFiltersDialogOpen] = useState(false);
  const [filters, setFilters] = useState<TransactionFilters>(() => ({
    ...defaultDateRange(),
    // Both validated: the params are cleared right after this, so a malformed
    // one would 400 every query with no chip left to clear.
    categoryId: filterShape.categoryId.safeParse(searchParams.get('categoryId') ?? undefined).data,
    type: filterShape.type.safeParse(searchParams.get('type') ?? undefined).data,
  }));
  const [sort, setSort] = useState<TransactionSort>(DEFAULT_TRANSACTION_SORT);
  const [error, setError] = useState<string | null>(null);
  const [categoryConfirmation, setCategoryConfirmation] = useState<{
    transactionId: string;
    transactionInput: CreateTransactionInput;
    suggestedCategory: { id: string; name: string };
  } | null>(null);

  // Left in the address bar, consumed params would restore abandoned filters on
  // a refresh. history rather than router, which would refetch the route.
  // Read once: later filter edits must not re-run the cleanup.
  const [arrivedWithParams] = useState(() => searchParams.toString() !== '');
  useEffect(() => {
    if (arrivedWithParams) {
      window.history.replaceState(null, '', '/transactions');
    }
  }, [arrivedWithParams]);

  const {
    data,
    isLoading: loading,
    isError: loadFailed,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useTransactionsInfiniteQuery(filters, sort);
  const transactions = useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data]);
  const { data: categories = [] } = useCategoriesQuery();
  const { data: summary } = useTransactionsSummaryQuery(filters);
  // Each chart ignores the filter it drives: filtering a chart by its own
  // selection would zero the slices the user has to click to go back. While
  // the breakdown is open the category is its selection, not a dialog filter.
  const {
    data: chartSummary,
    isLoading: chartSummaryLoading,
    isError: chartSummaryFailed,
  } = useTransactionsSummaryQuery({
    ...filters,
    type: undefined,
    categoryId: filters.type ? undefined : filters.categoryId,
  });
  const {
    data: categoryBreakdown = [],
    isLoading: categoryBreakdownLoading,
    isError: categoryBreakdownFailed,
  } = useCategoryBreakdownQuery({ ...filters, categoryId: undefined }, !!filters.type);

  const createMutation = useCreateTransactionMutation();
  const updateMutation = useUpdateTransactionMutation();
  const deleteMutation = useDeleteTransactionMutation();
  const exportMutation = useExportTransactionsCsvMutation();

  const handleExport = () =>
    exportMutation.mutate(
      { filters, sort },
      {
        onError: (exportError) =>
          setError(describeApiError(exportError, t('transactions.page.exportFailed'))),
      },
    );

  const handleEdit = (tx: Transaction) => {
    setEditTx(tx);
    setFormOpen(true);
  };

  // Must not catch: the form reports the outcome.
  const handleCreate = async (data: CreateTransactionInput) => {
    const result: CreateTransactionResponse = await createMutation.mutateAsync(data);
    if (result.suggestedCategory) {
      setCategoryConfirmation({
        transactionId: result.id,
        transactionInput: data,
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

  return (
    <>
      <PageHeader
        title={t('nav.transactions')}
        actions={
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
              {t('transactions.page.exportCsv')}
            </Button>
            {canWrite && (
              <Button
                variant="contained"
                startIcon={<AddRoundedIcon />}
                onClick={() => {
                  setEditTx(null);
                  setFormOpen(true);
                }}
              >
                {t('transactions.page.add')}
              </Button>
            )}
          </Stack>
        }
      />

      <PendingTransactionsPopup />

      <IncomeExpensePieChart
        income={chartSummary?.totalIncome || 0}
        expense={chartSummary?.totalExpense || 0}
        loading={chartSummaryLoading}
        error={chartSummaryFailed}
        selectedType={filters.type}
        onSelectType={(type) =>
          setFilters((prev) => ({
            ...prev,
            type: prev.type === type ? undefined : type,
            categoryId: prev.type ? undefined : prev.categoryId,
          }))
        }
        title={describeDateRange({ range: filters, t, formatter })}
      />

      {filters.type && (
        <CategoryBreakdownPieChart
          title={
            filters.type === 'EXPENSE'
              ? t('transactions.page.expensesByCategory')
              : t('transactions.page.incomeByCategory')
          }
          items={categoryBreakdown}
          loading={categoryBreakdownLoading}
          error={categoryBreakdownFailed}
          selectedCategoryId={filters.categoryId}
          onSelectCategory={(categoryId) =>
            setFilters((prev) => ({
              ...prev,
              categoryId: prev.categoryId === categoryId ? undefined : categoryId,
            }))
          }
        />
      )}

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{
          mt: 2,
          justifyContent: 'space-between',
          alignItems: { sm: 'center' },
        }}
      >
        <TransactionFiltersDisplay
          {...filters}
          onOpenFilters={() => setFiltersDialogOpen(true)}
          categories={categories}
          onResetSearch={() => setFilters((prev) => ({ ...prev, searchTerm: undefined }))}
          onResetCategory={() => setFilters((prev) => ({ ...prev, categoryId: undefined }))}
          onResetType={() => setFilters((prev) => ({ ...prev, type: undefined }))}
          onResetDateRange={() =>
            setFilters((prev) => ({
              ...prev,
              startDate: undefined,
              endDate: undefined,
            }))
          }
        />
        <TransactionSortSelect value={sort} onChange={setSort} />
      </Stack>

      <Box sx={{ mt: 2 }}>
        {loading ? (
          <TransactionListSkeleton rows={6} />
        ) : loadFailed ? (
          <Alert severity="error">{t('transactions.page.loadFailed')}</Alert>
        ) : (
          <>
            {summary && summary.count > 0 && (
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  display: 'block',
                  mb: 1,
                }}
              >
                {t('transactions.page.showing', {
                  shown: formatter.number({ value: transactions.length }),
                  total: formatter.number({ value: summary.count }),
                })}
              </Typography>
            )}
            <TransactionList
              transactions={transactions}
              onEditAction={canWrite ? handleEdit : undefined}
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
        onSubmitAction={editTx ? (data) => handleUpdate(editTx.id, data) : handleCreate}
        onDeleteAction={deleteTransaction}
        initialData={
          editTx
            ? {
                id: editTx.id,
                description: editTx.description,
                value: editTx.value,
                currency: editTx.currency,
                originalAmount: editTx.originalAmount,
                exchangeRate: editTx.exchangeRate,
                exchangeRateSource: editTx.exchangeRateSource,
                categoryId: editTx.category.id,
                type: editTx.type,
                date: editTx.date,
                addedBy: editTx.addedBy,
                editedBy: editTx.editedBy,
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
          transactionInput={categoryConfirmation.transactionInput}
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
