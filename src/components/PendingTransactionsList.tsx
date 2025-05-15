import React, { useState } from "react";
import { Transaction } from "../types";
import { formatTransactionDate } from "../utils/format";
import EmptyState from "./EmptyState";

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

function getButtonClass(type: string) {
  if (type === "approve") {
    return "button-secondary";
  }
  if (type === "delete") {
    return "button-secondary delete-button-red";
  }
  return "button-primary";
}

export default function PendingTransactionsList({
  transactions,
  onConfirmAction,
  onDeleteAction,
}: Props) {
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  function openDialog(transaction: Transaction) {
    setSelectedTransaction(transaction);
    setIsDialogOpen(true);
  }

  function closeDialog() {
    setIsDialogOpen(false);
    setSelectedTransaction(null);
  }

  function handleApprove() {
    if (selectedTransaction) {
      onConfirmAction(selectedTransaction.id);
      closeDialog();
    }
  }

  function handleDelete() {
    if (selectedTransaction) {
      onDeleteAction(selectedTransaction.id);
      closeDialog();
    }
  }

  if (transactions.length === 0) {
    return <EmptyState message="No pending transactions found." />;
  }

  return (
    <div className="card-accent" style={{ padding: 0 }}>
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
                <div style={{ fontSize: "0.95em", color: "#888" }}>
                  {tx.category?.name}
                </div>
              </td>
              <td>
                <div style={{ color: getValueColor(tx.type), fontWeight: 600 }}>
                  {getFormattedValue(tx.value)}
                </div>
                <div style={{ fontSize: "0.95em", color: "#888" }}>
                  {formatTransactionDate(tx.date)}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {isDialogOpen && selectedTransaction && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 8,
              padding: 24,
              minWidth: 300,
              boxShadow: "0 2px 16px rgba(0,0,0,0.15)",
            }}
          >
            <div style={{ marginBottom: 16, fontWeight: 600 }}>
              {selectedTransaction.description}
            </div>
            <div style={{ marginBottom: 24 }}>
              Approve or delete this transaction?
            </div>
            <div
              style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}
            >
              <button
                onClick={handleApprove}
                className={getButtonClass("approve")}
              >
                Approve
              </button>
              <button
                onClick={handleDelete}
                className={getButtonClass("delete")}
                style={{ background: "#e74c3c", color: "#fff" }}
              >
                Delete
              </button>
              <button onClick={closeDialog} className={getButtonClass("close")}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
