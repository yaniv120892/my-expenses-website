import React, { useEffect } from "react";
import PendingTransactionsList from "../../components/PendingTransactionsList";
import TransactionListSkeleton from "../../components/TransactionListSkeleton";
import { Box, Snackbar, Alert } from "@mui/material";
import { usePendingTransactions } from "../../hooks/usePendingTransactions";

export default function PendingTransactionsTab() {
  const {
    pendingTransactions,
    loading,
    error,
    fetchPendingTransactions,
    handleConfirm,
    handleDelete,
    setError,
  } = usePendingTransactions();

  useEffect(() => {
    fetchPendingTransactions();
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
