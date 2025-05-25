import React, { useState } from "react";
import PendingTransactionsList from "../../components/PendingTransactionsList";
import PendingTransactionListSkeleton from "../../components/PendingTransactionListSkeleton";
import { Box, Snackbar, Alert } from "@mui/material";
import {
  usePendingTransactionsQuery,
  useConfirmTransactionMutation,
  useDeletePendingTransactionMutation,
} from "../../hooks/usePendingTransactionsQuery";

export default function PendingTransactionsTab() {
  const [error, setError] = useState<string | null>(null);
  const { data: pendingTransactions = [], isLoading } =
    usePendingTransactionsQuery();
  const confirmMutation = useConfirmTransactionMutation();
  const deleteMutation = useDeletePendingTransactionMutation();

  async function handleConfirm(id: string) {
    try {
      await confirmMutation.mutateAsync(id);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to confirm transaction"
      );
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteMutation.mutateAsync(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete transaction");
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
      {isLoading ? (
        <PendingTransactionListSkeleton rows={6} />
      ) : (
        <PendingTransactionsList
          transactions={pendingTransactions}
          onConfirmAction={handleConfirm}
          onDeleteAction={handleDelete}
        />
      )}
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
