import React, { useState } from "react";
import { Transaction } from "../types";
import { formatTransactionDate } from "../utils/format";
import CheckIcon from "@mui/icons-material/Check";
import DeleteIcon from "@mui/icons-material/Delete";
import CircularProgress from "@mui/material/CircularProgress";
import EmptyState from "./EmptyState";

type Props = {
  transactions: Transaction[];
  onConfirmAction: (id: string) => void;
  onDeleteAction: (id: string) => void;
};

export default function PendingTransactionsList({
  transactions,
  onConfirmAction,
  onDeleteAction,
}: Props) {
  const [loadingConfirmId, setLoadingConfirmId] = useState<string | null>(null);
  const [loadingDeleteId, setLoadingDeleteId] = useState<string | null>(null);

  if (!transactions.length) {
    return <EmptyState message="No pending transactions found." />;
  }

  const handleConfirm = async (id: string) => {
    setLoadingConfirmId(id);
    try {
      await onConfirmAction(id);
    } finally {
      setLoadingConfirmId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setLoadingDeleteId(id);
    try {
      await onDeleteAction(id);
    } finally {
      setLoadingDeleteId(null);
    }
  };

  return (
    <div className="card-accent" style={{ padding: 0 }}>
      <table className="table">
        <thead>
          <tr>
            <th>Description</th>
            <th>Value</th>
            <th>Type</th>
            <th>Category</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => (
            <tr key={tx.id}>
              <td>{tx.description}</td>
              <td
                style={{
                  color:
                    tx.type === "INCOME"
                      ? "var(--accent-green)"
                      : "var(--accent-red)",
                  fontWeight: 600,
                }}
              >
                {tx.value}
              </td>
              <td style={{ textTransform: "uppercase" }}>{tx.type}</td>
              <td>{tx.category?.name}</td>
              <td>{formatTransactionDate(tx.date)}</td>
              <td style={{ textAlign: "right" }}>
                <span
                  style={{
                    display: "flex",
                    gap: 6,
                    justifyContent: "flex-end",
                  }}
                >
                  <button
                    className="button-secondary"
                    style={{
                      padding: "0.3rem 0.8rem",
                      fontSize: "0.95rem",
                      background: "var(--accent-green)",
                      cursor:
                        loadingConfirmId === tx.id ? "default" : "pointer",
                      opacity: loadingConfirmId === tx.id ? 0.7 : 1,
                    }}
                    onClick={() => handleConfirm(tx.id)}
                    aria-label="Confirm"
                    disabled={
                      loadingConfirmId === tx.id || loadingDeleteId === tx.id
                    }
                  >
                    {loadingConfirmId === tx.id ? (
                      <CircularProgress size={18} style={{ color: "#fff" }} />
                    ) : (
                      <CheckIcon fontSize="small" />
                    )}
                  </button>
                  <button
                    className="button-primary"
                    style={{
                      padding: "0.3rem 0.8rem",
                      fontSize: "0.95rem",
                      background: "var(--accent-red)",
                      cursor: loadingDeleteId === tx.id ? "default" : "pointer",
                      opacity: loadingDeleteId === tx.id ? 0.7 : 1,
                    }}
                    onClick={() => handleDelete(tx.id)}
                    aria-label="Delete"
                    disabled={
                      loadingDeleteId === tx.id || loadingConfirmId === tx.id
                    }
                  >
                    {loadingDeleteId === tx.id ? (
                      <CircularProgress size={18} style={{ color: "#fff" }} />
                    ) : (
                      <DeleteIcon fontSize="small" />
                    )}
                  </button>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
