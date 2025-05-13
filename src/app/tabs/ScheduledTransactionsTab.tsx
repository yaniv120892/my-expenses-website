import React, { useState, useEffect } from "react";
import ScheduledTransactionList from "../../components/ScheduledTransactionList";
import ScheduledTransactionForm from "../../components/ScheduledTransactionForm";
import TransactionListSkeleton from "../../components/TransactionListSkeleton";
import { Fab, Box, Snackbar, Alert } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import {
  CreateScheduledTransactionInput,
  ScheduledTransaction,
  UpdateScheduledTransactionInput,
} from "../../types";
import { useScheduledTransactions } from "../../hooks/useScheduledTransactions";

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

  const handleFormSubmit = async (
    data: CreateScheduledTransactionInput | UpdateScheduledTransactionInput
  ) => {
    if (editTx) {
      await handleUpdate(editTx.id, data as UpdateScheduledTransactionInput);
    } else {
      await handleCreate(data as CreateScheduledTransactionInput);
    }
  };

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
      {loading ? (
        <TransactionListSkeleton rows={6} />
      ) : (
        <ScheduledTransactionList
          scheduledTransactions={scheduledTransactions}
          categories={categories}
          onEditAction={(tx) => {
            setEditTx(tx);
            setFormOpen(true);
          }}
          onDeleteAction={handleDelete}
        />
      )}
      <Fab
        color="primary"
        aria-label="add"
        sx={{ position: "fixed", bottom: 32, right: 32, zIndex: 2000 }}
        onClick={() => {
          setFormOpen(true);
          setEditTx(null);
        }}
      >
        <AddIcon />
      </Fab>
      <ScheduledTransactionForm
        open={formOpen}
        onCloseAction={() => {
          setFormOpen(false);
          setEditTx(null);
        }}
        onSubmitAction={handleFormSubmit}
        initialData={editTx}
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
