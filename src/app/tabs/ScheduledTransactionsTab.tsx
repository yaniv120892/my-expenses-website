import React, { useState } from "react";
import ScheduledTransactionList from "../../components/ScheduledTransactionList";
import ScheduledTransactionForm from "../../components/ScheduledTransactionForm";
import ScheduledTransactionListSkeleton from "../../components/ScheduledTransactionListSkeleton";
import { Fab, Box, Snackbar, Alert } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import {
  Category,
  CreateScheduledTransactionInput,
  ScheduledTransaction,
  UpdateScheduledTransactionInput,
} from "../../types";
import {
  useScheduledTransactionsQuery,
  useCreateScheduledTransactionMutation,
  useUpdateScheduledTransactionMutation,
  useDeleteScheduledTransactionMutation,
} from "../../hooks/useScheduledTransactionsQuery";
import { useCategoriesQuery } from "../../hooks/useTransactionsQuery";

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
  if (loading) {
    return <ScheduledTransactionListSkeleton rows={6} />;
  }
  return (
    <Box flex={1} sx={{ position: "relative" }}>
      <ScheduledTransactionList
        scheduledTransactions={scheduledTransactions}
        categories={categories}
        onEditAction={onEdit}
      />
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
    data: CreateScheduledTransactionInput | UpdateScheduledTransactionInput
  ) {
    try {
      if (editTx) {
        await updateMutation.mutateAsync({ id: editTx.id, data });
      } else {
        await createMutation.mutateAsync(
          data as CreateScheduledTransactionInput
        );
      }
      setFormOpen(false);
      setEditTx(null);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to save scheduled transaction"
      );
    }
  }

  function handleEdit(tx: ScheduledTransaction) {
    setEditTx(tx);
    setFormOpen(true);
  }

  function handleAddClick() {
    setFormOpen(true);
    setEditTx(null);
  }

  async function handleDelete(id: string) {
    try {
      await deleteMutation.mutateAsync(id);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Failed to delete scheduled transaction"
      );
    }
  }

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
        onDeleteAction={handleDelete}
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
