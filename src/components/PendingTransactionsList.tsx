import React, { useState } from "react";
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
} from "@mui/material";
import { Transaction } from "../types";
import { formatTransactionDate } from "../utils/format";
import EmptyState from "./EmptyState";
import NotificationSnackbar from "./NotificationSnackbar";
import SwipeableRow from "./SwipeableRow";
import { useIsMobile } from "@/hooks/useIsMobile";

type Props = {
  transactions: Transaction[];
  onConfirmAction: (id: string) => void;
  onDeleteAction: (id: string) => void;
};

function getValueColor(type: string) {
  if (type === "INCOME") {
    return "var(--accent-green)";
  }
  return "var(--accent-red)";
}

function getFormattedValue(value: number) {
  return value.toLocaleString("he-IL", { style: "currency", currency: "ILS" });
}

export default function PendingTransactionsList({
  transactions,
  onConfirmAction,
  onDeleteAction,
}: Props) {
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [snackbarSeverity, setSnackbarSeverity] = useState<"success" | "error">(
    "success"
  );
  const isMobile = useIsMobile();

  function showSnackbar(
    message: string,
    severity: "success" | "error" = "success"
  ) {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  }

  function openDialog(transaction: Transaction) {
    setSelectedTransaction(transaction);
    setIsDialogOpen(true);
  }

  function closeDialog() {
    setIsDialogOpen(false);
    setSelectedTransaction(null);
  }

  async function handleApprove() {
    if (selectedTransaction) {
      try {
        await onConfirmAction(selectedTransaction.id);
        showSnackbar("Transaction approved successfully", "success");
      } catch {
        showSnackbar("Failed to approve transaction", "error");
      }
      closeDialog();
    }
  }

  async function handleDelete() {
    if (selectedTransaction) {
      try {
        await onDeleteAction(selectedTransaction.id);
        showSnackbar("Transaction rejected successfully", "success");
      } catch {
        showSnackbar("Failed to reject transaction", "error");
      }
      closeDialog();
    }
  }

  async function handleQuickApprove(id: string) {
    try {
      await onConfirmAction(id);
      showSnackbar("Transaction approved successfully", "success");
    } catch {
      showSnackbar("Failed to approve transaction", "error");
    }
  }

  async function handleQuickDelete(id: string) {
    try {
      await onDeleteAction(id);
      showSnackbar("Transaction rejected successfully", "success");
    } catch {
      showSnackbar("Failed to reject transaction", "error");
    }
  }

  if (transactions.length === 0) {
    return <EmptyState message="No pending transactions found." />;
  }

  const renderRow = (tx: Transaction) => (
    <div
      style={{ cursor: "pointer", padding: "0.7rem 0.5rem" }}
      onClick={() => openDialog(tx)}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: 600 }}>{tx.description}</div>
          <div style={{ fontSize: "0.95em", color: "var(--text-secondary)" }}>
            {tx.category?.name}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: getValueColor(tx.type), fontWeight: 600 }}>
            {getFormattedValue(tx.value)}
          </div>
          <div style={{ fontSize: "0.95em", color: "var(--text-secondary)" }}>
            {formatTransactionDate(tx.date)}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="card-accent" style={{ padding: 0 }}>
        {isMobile ? (
          <div>
            {transactions.map((tx) => (
              <SwipeableRow
                key={tx.id}
                onSwipeRight={() => handleQuickApprove(tx.id)}
                onSwipeLeft={() => handleQuickDelete(tx.id)}
                rightLabel="Approve"
                rightColor="success.main"
                leftLabel="Delete"
                leftColor="error.main"
              >
                {renderRow(tx)}
              </SwipeableRow>
            ))}
          </div>
        ) : (
          <table className="table">
            <tbody>
              {transactions.map((tx) => (
                <tr
                  key={tx.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => openDialog(tx)}
                >
                  <td>
                    <div style={{ fontWeight: 600 }}>{tx.description}</div>
                    <div style={{ fontSize: "0.95em", color: "var(--text-secondary)" }}>
                      {tx.category?.name}
                    </div>
                  </td>
                  <td>
                    <div
                      style={{ color: getValueColor(tx.type), fontWeight: 600 }}
                    >
                      {getFormattedValue(tx.value)}
                    </div>
                    <div style={{ fontSize: "0.95em", color: "var(--text-secondary)" }}>
                      {formatTransactionDate(tx.date)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Dialog open={isDialogOpen && !!selectedTransaction} onClose={closeDialog}>
          {selectedTransaction && (
            <>
              <DialogTitle sx={{ fontWeight: 600 }}>
                {selectedTransaction.description}
              </DialogTitle>
              <DialogContent>
                <Typography>
                  Approve or delete this transaction?
                </Typography>
              </DialogContent>
              <DialogActions sx={{ p: 2, gap: 1 }}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleApprove}
                >
                  Approve
                </Button>
                <Button
                  variant="contained"
                  color="error"
                  onClick={handleDelete}
                >
                  Delete
                </Button>
                <Button
                  variant="outlined"
                  onClick={closeDialog}
                >
                  Cancel
                </Button>
              </DialogActions>
            </>
          )}
        </Dialog>
      </div>
      <NotificationSnackbar
        open={snackbarOpen}
        message={snackbarMessage}
        severity={snackbarSeverity}
        onClose={() => setSnackbarOpen(false)}
      />
    </>
  );
}
