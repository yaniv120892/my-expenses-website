import React from "react";
import { Transaction } from "../types";
import { formatTransactionDate } from "../utils/format";
import CheckIcon from "@mui/icons-material/Check";
import DeleteIcon from "@mui/icons-material/Delete";
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
  if (!transactions.length) {
    return <EmptyState message="No pending transactions found." />;
  }

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
                    }}
                    onClick={() => onConfirmAction(tx.id)}
                    aria-label="Confirm"
                  >
                    <CheckIcon fontSize="small" />
                  </button>
                  <button
                    className="button-primary"
                    style={{
                      padding: "0.3rem 0.8rem",
                      fontSize: "0.95rem",
                      background: "var(--accent-red)",
                    }}
                    onClick={() => onDeleteAction(tx.id)}
                    aria-label="Delete"
                  >
                    <DeleteIcon fontSize="small" />
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
