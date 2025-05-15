"use client";

import React from "react";
import { Transaction } from "../types";
import { formatTransactionDate } from "../utils/format";
import EmptyState from "./EmptyState";
import { useIsMobile } from "@/hooks/useIsMobile";

function getValueColor(type: string) {
  if (type === "INCOME") {
    return "var(--accent-green)";
  }
  return "var(--accent-red)";
}

function getFormattedValue(value: number) {
  return value.toLocaleString("he-IL", { style: "currency", currency: "ILS" });
}

function TransactionRowMobile({
  transaction,
  onEdit,
}: {
  transaction: Transaction;
  onEdit: (tx: Transaction) => void;
}) {
  function handleRowClick() {
    onEdit(transaction);
  }
  return (
    <tr style={{ cursor: "pointer" }} onClick={handleRowClick}>
      <td style={{ padding: "0.7rem 0.5rem", border: "none" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ textAlign: "left" }}>
            <div style={{ fontWeight: 600, fontSize: "0.98em" }}>
              {transaction.description}
            </div>
            <div style={{ fontSize: "0.85em", color: "#888" }}>
              {transaction.category?.name}
            </div>
          </div>
          <div style={{ textAlign: "right", minWidth: 90 }}>
            <div
              style={{
                color: getValueColor(transaction.type),
                fontWeight: 600,
                fontSize: "0.98em",
              }}
            >
              {getFormattedValue(transaction.value)}
            </div>
            <div style={{ fontSize: "0.85em", color: "#888" }}>
              {formatTransactionDate(transaction.date)}
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}

function TransactionRowDesktop({
  transaction,
  onEdit,
}: {
  transaction: Transaction;
  onEdit: (tx: Transaction) => void;
}) {
  function handleRowClick() {
    onEdit(transaction);
  }
  return (
    <tr style={{ cursor: "pointer" }} onClick={handleRowClick}>
      <td>{transaction.description}</td>
      <td
        style={{
          color: getValueColor(transaction.type),
          fontWeight: 600,
        }}
      >
        {getFormattedValue(transaction.value)}
      </td>
      <td>{transaction.category?.name}</td>
      <td>{formatTransactionDate(transaction.date)}</td>
    </tr>
  );
}

export default function TransactionList({
  transactions,
  onEditAction,
}: {
  transactions: Transaction[];
  onEditAction: (tx: Transaction) => void;
  onDeleteAction: (id: string) => void;
}) {
  const isMobile = useIsMobile();

  if (!transactions.length) {
    return <EmptyState message="No transactions found." />;
  }

  async function handleEdit(tx: Transaction) {
    await onEditAction(tx);
  }

  if (isMobile) {
    return (
      <div className="card-accent" style={{ padding: 0 }}>
        <table
          className="table"
          style={{
            borderCollapse: "separate",
            borderSpacing: 0,
            width: "100%",
          }}
        >
          <tbody>
            {transactions.map((tx) => (
              <TransactionRowMobile
                key={tx.id}
                transaction={tx}
                onEdit={handleEdit}
              />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="card-accent" style={{ padding: 0 }}>
      <table className="table">
        <thead>
          <tr>
            <th>Description</th>
            <th>Value</th>
            <th>Category</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => (
            <TransactionRowDesktop
              key={tx.id}
              transaction={tx}
              onEdit={handleEdit}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
