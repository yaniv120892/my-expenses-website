"use client";

import React from "react";
import { ScheduledTransaction, Category } from "../types";
import EmptyState from "./EmptyState";
import {
  formatTransactionDate,
  translateToScheduleSummary,
} from "../utils/format";
import { useIsMobile } from "@/hooks/useIsMobile";

function getCategoryName(categoryId: string, categories: Category[]) {
  const found = categories.find((cat) => cat.id === categoryId);
  return found ? found.name : "N/A";
}

function getValueColor(type: string) {
  if (type === "INCOME") {
    return "var(--accent-green)";
  }
  return "var(--accent-red)";
}

function getFormattedValue(value: number) {
  return value.toLocaleString("he-IL", { style: "currency", currency: "ILS" });
}

function ScheduledTransactionRowMobile({
  tx,
  categories,
  onEdit,
}: {
  tx: ScheduledTransaction;
  categories: Category[];
  onEdit: (tx: ScheduledTransaction) => void;
}) {
  function handleRowClick() {
    onEdit(tx);
  }
  return (
    <tr style={{ cursor: "pointer" }} onClick={handleRowClick}>
      <td style={{ padding: "1.2rem 0.5rem", border: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: "#eee",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: "1.1em" }}>
              {tx.description}
            </div>
            <div style={{ fontSize: "0.97em", color: "#888" }}>
              {getCategoryName(tx.categoryId, categories)}
            </div>
            <div style={{ fontSize: "0.97em", color: "#888" }}>
              {translateToScheduleSummary(
                tx.scheduleType,
                tx.interval,
                tx.dayOfWeek,
                tx.dayOfMonth
              )}
            </div>
          </div>
          <div style={{ textAlign: "right", minWidth: 110 }}>
            <div
              style={{
                color: getValueColor(tx.type),
                fontWeight: 600,
                fontSize: "1.1em",
              }}
            >
              {getFormattedValue(tx.value)}
            </div>
            <div style={{ fontSize: "0.97em", color: "#888" }}>
              {formatTransactionDate(tx.nextRunDate)}
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}

function ScheduledTransactionRowDesktop({
  tx,
  categories,
  onEdit,
}: {
  tx: ScheduledTransaction;
  categories: Category[];
  onEdit: (tx: ScheduledTransaction) => void;
}) {
  function handleRowClick() {
    onEdit(tx);
  }
  return (
    <tr style={{ cursor: "pointer" }} onClick={handleRowClick}>
      <td>{tx.description}</td>
      <td
        style={{
          color: getValueColor(tx.type),
          fontWeight: 600,
        }}
      >
        {getFormattedValue(tx.value)}
      </td>
      <td style={{ textTransform: "uppercase" }}>{tx.type}</td>
      <td>{getCategoryName(tx.categoryId, categories)}</td>
      <td>
        {translateToScheduleSummary(
          tx.scheduleType,
          tx.interval,
          tx.dayOfWeek,
          tx.dayOfMonth
        )}
      </td>
      <td>{tx.nextRunDate ? formatTransactionDate(tx.nextRunDate) : "N/A"}</td>
    </tr>
  );
}

export default function ScheduledTransactionList({
  scheduledTransactions,
  categories,
  onEditAction,
}: {
  scheduledTransactions: ScheduledTransaction[];
  categories: Category[];
  onEditAction: (tx: ScheduledTransaction) => void;
}) {
  const isMobile = useIsMobile();

  if (!scheduledTransactions.length) {
    return <EmptyState message="No scheduled transactions found." />;
  }

  async function handleEdit(tx: ScheduledTransaction) {
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
            {scheduledTransactions.map((tx) => (
              <ScheduledTransactionRowMobile
                key={tx.id}
                tx={tx}
                categories={categories}
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
            <th>Type</th>
            <th>Category</th>
            <th>Schedule</th>
            <th>Next Run</th>
          </tr>
        </thead>
        <tbody>
          {scheduledTransactions.map((tx) => (
            <ScheduledTransactionRowDesktop
              key={tx.id}
              tx={tx}
              categories={categories}
              onEdit={handleEdit}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
