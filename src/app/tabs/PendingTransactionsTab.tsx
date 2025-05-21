import React from "react";
import PendingTransactionsList from "../../components/PendingTransactionsList";
import PendingTransactionListSkeleton from "../../components/PendingTransactionListSkeleton";
import { Box, Snackbar, Alert } from "@mui/material";
import { Transaction } from "../../types";

type PendingTransactionsTabProps = {
  pendingTransactions: Transaction[];
  loading: boolean;
  error: string | null;
  handleConfirm: (id: string) => void;
  handleDelete: (id: string) => void;
  setError: (err: string | null) => void;
};

export default function PendingTransactionsTab({
  pendingTransactions,
  loading,
  error,
  handleConfirm,
  handleDelete,
  setError,
}: PendingTransactionsTabProps) {
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
