import React, { useState, useEffect } from "react";
import { Transaction, TransactionFilters } from "../../types";
import TransactionList from "../../components/TransactionList";
import TransactionForm from "../../components/TransactionForm";
import TransactionListSkeleton from "../../components/TransactionListSkeleton";
import { Fab, Box, Alert, Snackbar } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { useTransactions } from "../../hooks/useTransactions";
import { TransactionFiltersDialog } from "../../components/transactions/TransactionFiltersDialog";
import { TransactionFiltersDisplay } from "../../components/transactions/TransactionFiltersDisplay";
import { getCategories } from "../../services/transactions";
import { Category } from "../../types";

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
  const {
    transactions,
    loading,
    error,
    fetchTransactions,
    handleCreate,
    handleUpdate,
    handleDelete,
    setError,
  } = useTransactions();
  const [formOpen, setFormOpen] = useState(false);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [filtersDialogOpen, setFiltersDialogOpen] = useState(false);
  const [filters, setFilters] = useState<TransactionFilters>({});
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const cats = await getCategories();
        setCategories(cats);
      } catch (error) {
        console.error("Error loading categories:", error);
      }
    };
    loadCategories();
  }, []);

  React.useEffect(() => {
    fetchTransactions();
  }, []);

  const handleApplyFilters = (newFilters: TransactionFilters) => {
    setFilters(newFilters);
    fetchTransactions(newFilters);
  };

  const handleEdit = (tx: Transaction) => {
    setEditTx(tx);
    setFormOpen(true);
  };

  const handleAddFabClick = () => {
    setFormOpen(true);
    setEditTx(null);
  };

  return (
    <Box sx={{ p: 3 }}>
      <TransactionFiltersDisplay
        {...filters}
        onOpenFilters={() => setFiltersDialogOpen(true)}
        categories={categories}
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
          editTx ? (data) => handleUpdate(editTx.id, data) : handleCreate
        }
        onDeleteAction={async (id) => {
          await handleDelete(id);
        }}
        initialData={editTx}
      />

      <AddTransactionFab onAddClick={handleAddFabClick} visible={!formOpen} />

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
