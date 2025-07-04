import React, { useState } from "react";
import {
  Transaction,
  TransactionFilters,
  CreateTransactionInput,
} from "../../types";
import TransactionList from "../../components/TransactionList";
import TransactionForm from "../../components/TransactionForm";
import Chat from "../../components/chat/Chat";
import TransactionListSkeleton from "../../components/TransactionListSkeleton";
import { Fab, Box, Alert, Snackbar } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { TransactionFiltersDialog } from "../../components/transactions/TransactionFiltersDialog";
import { TransactionFiltersDisplay } from "../../components/transactions/TransactionFiltersDisplay";
import {
  useTransactionsQuery,
  useCategoriesQuery,
  useCreateTransactionMutation,
  useUpdateTransactionMutation,
  useDeleteTransactionMutation,
} from "../../hooks/useTransactionsQuery";

function TransactionTableArea({
  loading,
  transactions,
  onEdit,
  onDelete,
}: {
  loading: boolean;
  transactions: Transaction[];
  onEdit: (tx: Transaction) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Box flex={1} sx={{ position: "relative" }}>
      {loading ? (
        <TransactionListSkeleton rows={6} />
      ) : (
        <TransactionList
          transactions={transactions}
          onEditAction={onEdit}
          onDeleteAction={onDelete}
        />
      )}
    </Box>
  );
}

function AddTransactionFab({
  onAddClick,
  visible,
}: {
  onAddClick: () => void;
  visible: boolean;
}) {
  if (visible) {
    return (
      <Box
        sx={{
          position: "fixed",
          bottom: 32,
          right: 32,
          display: "flex",
          flexDirection: "row",
          gap: 2,
          zIndex: 2000,
        }}
      >
        <Fab color="secondary" aria-label="add" onClick={onAddClick}>
          <AddIcon />
        </Fab>
      </Box>
    );
  }
  return null;
}

export default function TransactionsTab() {
  const [formOpen, setFormOpen] = useState(false);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [filtersDialogOpen, setFiltersDialogOpen] = useState(false);
  const [filters, setFilters] = useState<TransactionFilters>({});
  const [error, setError] = useState<string | null>(null);

  const { data: transactions = [], isLoading: loading } =
    useTransactionsQuery(filters);
  const { data: categories = [] } = useCategoriesQuery();

  const createMutation = useCreateTransactionMutation();
  const updateMutation = useUpdateTransactionMutation();
  const deleteMutation = useDeleteTransactionMutation();

  const handleApplyFilters = (newFilters: TransactionFilters) => {
    setFilters(newFilters);
  };

  const handleEdit = (tx: Transaction) => {
    setEditTx(tx);
    setFormOpen(true);
  };

  const handleAddFabClick = () => {
    setFormOpen(true);
    setEditTx(null);
  };

  const handleCreateSuccess = async (data: CreateTransactionInput) => {
    try {
      await createMutation.mutateAsync(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create transaction");
    }
  };

  const handleUpdateSuccess = async (
    id: string,
    data: CreateTransactionInput
  ) => {
    try {
      await updateMutation.mutateAsync({ id, data });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update transaction");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete transaction");
    }
  };

  const handleResetSearch = () => {
    setFilters((prev) => ({ ...prev, searchTerm: undefined }));
  };

  const handleResetCategory = () => {
    setFilters((prev) => ({ ...prev, categoryId: undefined }));
  };

  const handleResetDateRange = () => {
    setFilters((prev) => ({
      ...prev,
      startDate: undefined,
      endDate: undefined,
    }));
  };

  return (
    <Box sx={{ p: 3 }}>
      <TransactionFiltersDisplay
        {...filters}
        onOpenFilters={() => setFiltersDialogOpen(true)}
        categories={categories}
        onResetSearch={handleResetSearch}
        onResetCategory={handleResetCategory}
        onResetDateRange={handleResetDateRange}
      />

      <Box sx={{ mt: 2, flex: 1 }}>
        <TransactionTableArea
          loading={loading}
          transactions={transactions}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </Box>

      <TransactionForm
        open={formOpen}
        onCloseAction={() => {
          setFormOpen(false);
          setEditTx(null);
        }}
        onSubmitAction={
          editTx
            ? (data) => handleUpdateSuccess(editTx.id, data)
            : handleCreateSuccess
        }
        onDeleteAction={handleDelete}
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

      <Chat />
      {!formOpen && <AddTransactionFab onAddClick={handleAddFabClick} visible={true} />}

      <TransactionFiltersDialog
        open={filtersDialogOpen}
        onClose={() => setFiltersDialogOpen(false)}
        onApply={handleApplyFilters}
        initialFilters={filters}
      />

      <Snackbar
        open={!!error}
        autoHideDuration={4000}
        onClose={() => setError(null)}
      >
        <Alert severity="error">{error}</Alert>
      </Snackbar>
    </Box>
  );
}
