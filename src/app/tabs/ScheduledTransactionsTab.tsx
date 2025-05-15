import React, { useState, useEffect } from "react";
import ScheduledTransactionList from "../../components/ScheduledTransactionList";
import ScheduledTransactionForm from "../../components/ScheduledTransactionForm";
import TransactionListSkeleton from "../../components/TransactionListSkeleton";
import { Fab, Box, Snackbar, Alert } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import {
  Category,
  CreateScheduledTransactionInput,
  ScheduledTransaction,
  UpdateScheduledTransactionInput,
} from "../../types";
import { useScheduledTransactions } from "../../hooks/useScheduledTransactions";

function ScheduleTransactionTableArea({
  loading,
  scheduledTransactions,
  categories,
  onEdit,
}: {
  loading: boolean;
  scheduledTransactions: ScheduledTransaction[];
  categories: Category[];
  onEdit: (tx: ScheduledTransaction) => void;
}) {
  return (
    <Box flex={1} sx={{ position: "relative" }}>
      {loading ? (
        <TransactionListSkeleton rows={6} />
      ) : (
        <ScheduledTransactionList
          scheduledTransactions={scheduledTransactions}
          categories={categories}
          onEditAction={onEdit}
        />
      )}
    </Box>
  );
}

function AddScheduledTransactionFab({
  onClick,
  visible,
}: {
  onClick: () => void;
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
        <Fab color="secondary" aria-label="add" onClick={onClick}>
          <AddIcon />
        </Fab>
      </Box>
    );
  }
  return null;
}

export default function ScheduledTransactionsTab() {
  const {
    scheduledTransactions,
    categories,
    loading,
    error,
    fetchScheduledTransactions,
    fetchCategories,
    handleCreate,
    handleUpdate,
    handleDelete,
    setError,
  } = useScheduledTransactions();
  const [formOpen, setFormOpen] = useState(false);
  const [editTx, setEditTx] = useState<ScheduledTransaction | null>(null);

  function handleFormSubmit(
    data: CreateScheduledTransactionInput | UpdateScheduledTransactionInput
  ) {
    if (editTx) {
      return handleUpdate(editTx.id, data as UpdateScheduledTransactionInput);
    }
    return handleCreate(data as CreateScheduledTransactionInput);
  }

  function handleEdit(tx: ScheduledTransaction) {
    setEditTx(tx);
    setFormOpen(true);
  }

  function handleAddClick() {
    setFormOpen(true);
    setEditTx(null);
  }

  useEffect(() => {
    fetchScheduledTransactions();
    fetchCategories();
  }, []);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 3,
        position: "relative",
      }}
    >
      <ScheduleTransactionTableArea
        loading={loading}
        scheduledTransactions={scheduledTransactions}
        categories={categories}
        onEdit={handleEdit}
      />
      <ScheduledTransactionForm
        open={formOpen}
        onCloseAction={() => {
          setFormOpen(false);
          setEditTx(null);
        }}
        onSubmitAction={handleFormSubmit}
        onDeleteAction={async (id) => {
          await handleDelete(id);
        }}
        initialData={editTx}
      />
      <AddScheduledTransactionFab
        onClick={handleAddClick}
        visible={!formOpen}
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
