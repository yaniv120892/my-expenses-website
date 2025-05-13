"use client";

import React from "react";
import { ScheduledTransaction, Category } from "../types";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

interface Props {
  scheduledTransactions: ScheduledTransaction[];
  categories: Category[];
  onEditAction: (tx: ScheduledTransaction) => void;
  onDeleteAction: (id: string) => void;
}

function getCategoryName(categoryId: string, categories: Category[]) {
  const found = categories.find((cat) => cat.id === categoryId);
  return found ? found.name : "N/A";
}

function formatSchedule(tx: ScheduledTransaction) {
  let schedule = tx.scheduleType;
  if (tx.interval) schedule += ` every ${tx.interval}`;
  if (tx.dayOfWeek !== undefined) schedule += `, dayOfWeek: ${tx.dayOfWeek}`;
  if (tx.dayOfMonth !== undefined) schedule += `, dayOfMonth: ${tx.dayOfMonth}`;
  if (tx.monthOfYear !== undefined)
    schedule += `, monthOfYear: ${tx.monthOfYear}`;
  return schedule;
}

export default function ScheduledTransactionList({
  scheduledTransactions,
  categories,
  onEditAction,
  onDeleteAction,
}: Props) {
  if (!scheduledTransactions.length) {
    return (
      <div className="card-accent" style={{ color: "var(--accent-purple)" }}>
        No scheduled transactions found.
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
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {scheduledTransactions.map((tx) => (
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
              <td>{getCategoryName(tx.categoryId, categories)}</td>
              <td>{formatSchedule(tx)}</td>
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
                    style={{ padding: "0.3rem 0.8rem", fontSize: "0.95rem" }}
                    onClick={() => onEditAction(tx)}
                    aria-label="Edit"
                  >
                    <EditIcon fontSize="small" />
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
