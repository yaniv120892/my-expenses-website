import React from "react";
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

export default function PendingTransactionsList({
  transactions,
  onConfirmAction,
}: Props) {
  if (transactions.length === 0) {
    return <EmptyState message="No pending transactions found." />;
  }

  function handleRowClick(id: string) {
    onConfirmAction(id);
  }

  return (
    <div className="card-accent" style={{ padding: 0 }}>
      <table className="table">
        <tbody>
          {transactions.map((tx) => (
            <tr
              key={tx.id}
              style={{ cursor: "pointer" }}
              onClick={() => handleRowClick(tx.id)}
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
    </div>
  );
}
