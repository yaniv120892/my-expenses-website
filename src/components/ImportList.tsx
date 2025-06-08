"use client";

import React from "react";
import { Box, Typography, Chip, Collapse } from "@mui/material";
import { KeyboardArrowDown, KeyboardArrowUp } from "@mui/icons-material";
import { Import, ImportStatus } from "../types/import";
import { useImportsQuery } from "../hooks/useImports";
import ImportedTransactionList from "./ImportedTransactionList";
import { formatDate } from "../utils/dateUtils";
import { useIsMobile } from "@/hooks/useIsMobile";
import EmptyState from "./EmptyState";
import ImportListSkeleton from "./ImportListSkeleton";

function getStatusColor(status: ImportStatus) {
  switch (status) {
    case ImportStatus.COMPLETED:
      return "success";
    case ImportStatus.FAILED:
      return "error";
    case ImportStatus.PROCESSING:
      return "primary";
    default:
      return "default";
  }
}

function ImportRowMobile({
  importItem,
  onImportClick,
  isExpanded,
}: {
  importItem: Import;
  onImportClick: (id: string) => void;
  isExpanded: boolean;
}) {
  return (
    <tr
      style={{ cursor: "pointer" }}
      onClick={() => onImportClick(importItem.id)}
    >
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
              {importItem.originalFileName}
            </div>
            <div style={{ fontSize: "0.85em", color: "#888" }}>
              Card: {importItem.creditCardLastFourDigits || "N/A"} &bull; Month: {importItem.paymentMonth || "N/A"}
            </div>
            <div style={{ fontSize: "0.85em", color: "#888" }}>
              Created: {formatDate(importItem.createdAt, true)}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Chip
              label={importItem.status}
              color={getStatusColor(importItem.status)}
              size="small"
            />
            {isExpanded ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
          </div>
        </div>
      </td>
    </tr>
  );
}

function ImportRowDesktop({
  importItem,
  onImportClick,
  isExpanded,
}: {
  importItem: Import;
  onImportClick: (id: string) => void;
  isExpanded: boolean;
}) {
  return (
    <tr
      style={{ cursor: "pointer" }}
      onClick={() => onImportClick(importItem.id)}
    >
      <td style={{ width: 48, padding: "8px 0" }}>
        {isExpanded ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
      </td>
      <td>{importItem.originalFileName}</td>
      <td>{importItem.creditCardLastFourDigits || "N/A"}</td>
      <td>{importItem.paymentMonth || "N/A"}</td>
      <td>
        <Chip
          label={importItem.status}
          color={getStatusColor(importItem.status)}
          size="small"
        />
      </td>
      <td>{formatDate(importItem.createdAt, true)}</td>
    </tr>
  );
}

interface ImportListProps {
  onImportClick: (importId: string) => void;
  expandedImportId: string | null;
}

export default function ImportList({
  onImportClick,
  expandedImportId,
}: ImportListProps) {
  const { data: imports = [], isLoading } = useImportsQuery();
  const isMobile = useIsMobile();

  if (isLoading) {
    return <ImportListSkeleton rows={6} />;
  }

  if (!imports.length) {
    return <EmptyState message="No imports found." />;
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
            {imports.map((importItem) => (
              <React.Fragment key={importItem.id}>
                <ImportRowMobile
                  importItem={importItem}
                  onImportClick={onImportClick}
                  isExpanded={expandedImportId === importItem.id}
                />
                {importItem.status === ImportStatus.COMPLETED && (
                  <tr>
                    <td style={{ padding: 0 }}>
                      <Collapse
                        in={expandedImportId === importItem.id}
                        timeout="auto"
                        unmountOnExit
                      >
                        <Box sx={{ py: 2, px: 1 }}>
                          <ImportedTransactionList importId={importItem.id} />
                        </Box>
                      </Collapse>
                    </td>
                  </tr>
                )}
              </React.Fragment>
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
            <th style={{ width: 48 }}></th>
            <th>File Name</th>
            <th>Card (Last 4)</th>
            <th>Payment Month</th>
            <th>Status</th>
            <th>Created At</th>
          </tr>
        </thead>
        <tbody>
          {imports.map((importItem) => (
            <React.Fragment key={importItem.id}>
              <ImportRowDesktop
                importItem={importItem}
                onImportClick={onImportClick}
                isExpanded={expandedImportId === importItem.id}
              />
              <tr>
                <td colSpan={7} style={{ padding: 0 }}>
                  <Collapse
                    in={expandedImportId === importItem.id}
                    timeout="auto"
                    unmountOnExit
                  >
                    <Box sx={{ py: 2, px: 3 }}>
                      <ImportedTransactionList importId={importItem.id} />
                      {importItem.status === ImportStatus.FAILED && (
                        <Typography
                          color="error"
                          variant="body2"
                          sx={{ mt: 2 }}
                        >
                          Error: {importItem.error}
                        </Typography>
                      )}
                    </Box>
                  </Collapse>
                </td>
              </tr>
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
