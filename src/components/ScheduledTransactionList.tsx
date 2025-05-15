"use client";

import React, { useState } from "react";
import { ScheduledTransaction, Category } from "../types";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CircularProgress from "@mui/material/CircularProgress";
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
  onDelete,
  loadingEditId,
  loadingDeleteId,
}: {
  tx: ScheduledTransaction;
  categories: Category[];
  onEdit: (tx: ScheduledTransaction) => void;
  onDelete: (id: string) => void;
  loadingEditId: string | null;
  loadingDeleteId: string | null;
}) {
  function handleEditClick(e: React.MouseEvent) {
    e.stopPropagation();
    onEdit(tx);
  }
  function handleDeleteClick(e: React.MouseEvent) {
    e.stopPropagation();
    onDelete(tx.id);
  }
  return (
    <tr style={{ cursor: "pointer" }} onClick={() => onEdit(tx)}>
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
            <div
              style={{
                display: "flex",
                gap: 6,
                justifyContent: "flex-end",
                marginTop: 8,
              }}
            >
              <button
                className="button-secondary"
                style={{
                  padding: "0.3rem 0.8rem",
                  fontSize: "0.95rem",
                  cursor: loadingEditId === tx.id ? "default" : "pointer",
                  opacity: loadingEditId === tx.id ? 0.7 : 1,
                }}
                onClick={handleEditClick}
                aria-label="Edit"
                disabled={loadingEditId === tx.id || loadingDeleteId === tx.id}
              >
                {loadingEditId === tx.id ? (
                  <CircularProgress size={18} style={{ color: "#1976d2" }} />
                ) : (
                  <EditIcon fontSize="small" />
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
                onClick={handleDeleteClick}
                aria-label="Delete"
                disabled={loadingDeleteId === tx.id || loadingEditId === tx.id}
              >
                {loadingDeleteId === tx.id ? (
                  <CircularProgress size={18} style={{ color: "#fff" }} />
                ) : (
                  <DeleteIcon fontSize="small" />
                )}
              </button>
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}

export default function ScheduledTransactionList({
  scheduledTransactions,
  categories,
  onEditAction,
  onDeleteAction,
}: {
  scheduledTransactions: ScheduledTransaction[];
  categories: Category[];
  onEditAction: (tx: ScheduledTransaction) => void;
  onDeleteAction: (id: string) => void;
}) {
  const [loadingEditId, setLoadingEditId] = useState<string | null>(null);
  const [loadingDeleteId, setLoadingDeleteId] = useState<string | null>(null);
  const isMobile = useIsMobile();

  if (!scheduledTransactions.length) {
    return <EmptyState message="No scheduled transactions found." />;
  }

  async function handleEdit(tx: ScheduledTransaction) {
    setLoadingEditId(tx.id);
    try {
      await onEditAction(tx);
    } finally {
      setLoadingEditId(null);
    }
  }

  async function handleDelete(id: string) {
    setLoadingDeleteId(id);
    try {
      await onDeleteAction(id);
    } finally {
      setLoadingDeleteId(null);
    }
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
                onDelete={handleDelete}
                loadingEditId={loadingEditId}
                loadingDeleteId={loadingDeleteId}
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
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {scheduledTransactions.map((tx) => (
            <tr key={tx.id}>
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
              <td>
                {tx.nextRunDate ? formatTransactionDate(tx.nextRunDate) : "N/A"}
              </td>
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
                      cursor: loadingEditId === tx.id ? "default" : "pointer",
                      opacity: loadingEditId === tx.id ? 0.7 : 1,
                    }}
                    onClick={() => handleEdit(tx)}
                    aria-label="Edit"
                    disabled={
                      loadingEditId === tx.id || loadingDeleteId === tx.id
                    }
                  >
                    {loadingEditId === tx.id ? (
                      <CircularProgress
                        size={18}
                        style={{ color: "#1976d2" }}
                      />
                    ) : (
                      <EditIcon fontSize="small" />
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
                      loadingDeleteId === tx.id || loadingEditId === tx.id
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
