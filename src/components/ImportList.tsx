"use client";

import React, { useState, useMemo } from "react";
import {
  Box,
  Typography,
  Chip,
  Collapse,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import {
  KeyboardArrowDown,
  KeyboardArrowUp,
  CheckCircle,
  Cancel,
  Delete,
  ArrowUpward,
  ArrowDownward,
  Refresh,
} from "@mui/icons-material";
import { Import, ImportStatus } from "../types/import";
import { useImportsQuery, useDeleteImportMutation, useRematchImportMutation } from "../hooks/useImports";
import ImportedTransactionList from "./ImportedTransactionList";
import { formatDate } from "../utils/dateUtils";
import { useIsMobile } from "@/hooks/useIsMobile";
import EmptyState from "./EmptyState";
import ImportListSkeleton from "./ImportListSkeleton";

type SortField = "createdAt" | "paymentMonth" | "status";
type SortDirection = "asc" | "desc";

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

function SortIndicator({
  field,
  sortField,
  sortDirection,
}: {
  field: SortField;
  sortField: SortField;
  sortDirection: SortDirection;
}) {
  if (field !== sortField) return null;
  return sortDirection === "asc" ? (
    <ArrowUpward sx={{ fontSize: 16, ml: 0.5, verticalAlign: "middle" }} />
  ) : (
    <ArrowDownward sx={{ fontSize: 16, ml: 0.5, verticalAlign: "middle" }} />
  );
}

function ImportRowMobile({
  importItem,
  onImportClick,
  isExpanded,
  onDeleteClick,
  onRematchClick,
  isRematching,
}: {
  importItem: Import;
  onImportClick: (id: string) => void;
  isExpanded: boolean;
  onDeleteClick: (importItem: Import) => void;
  onRematchClick: (importItem: Import) => void;
  isRematching: boolean;
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
            <div style={{ fontSize: "0.85em", color: "var(--text-secondary)" }}>
              Card: {importItem.creditCardLastFourDigits || "N/A"} &bull; Month:{" "}
              {importItem.paymentMonth || "N/A"}
            </div>
            <div style={{ fontSize: "0.85em", color: "var(--text-secondary)" }}>
              Created: {formatDate(importItem.createdAt, true)}
            </div>
            <div style={{ fontSize: "0.85em", color: "var(--text-secondary)" }}>
              Updated: {formatDate(importItem.updatedAt, true)}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {importItem.status === ImportStatus.COMPLETED && !importItem.isVerified && (
              <IconButton
                size="small"
                color="primary"
                disabled={isRematching}
                onClick={(e) => {
                  e.stopPropagation();
                  onRematchClick(importItem);
                }}
              >
                <Refresh fontSize="small" />
              </IconButton>
            )}
            <IconButton
              size="small"
              color="error"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteClick(importItem);
              }}
            >
              <Delete fontSize="small" />
            </IconButton>
            {importItem.isVerified ? (
              <CheckCircle color="success" fontSize="small" />
            ) : (
              <Cancel color="warning" fontSize="small" />
            )}
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
  onDeleteClick,
  onRematchClick,
  isRematching,
}: {
  importItem: Import;
  onImportClick: (id: string) => void;
  isExpanded: boolean;
  onDeleteClick: (importItem: Import) => void;
  onRematchClick: (importItem: Import) => void;
  isRematching: boolean;
}) {
  return (
    <tr
      style={{ cursor: "pointer" }}
      onClick={() => onImportClick(importItem.id)}
    >
      <td style={{ width: 48, padding: "8px 0" }}>
        {isExpanded ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
      </td>
      <td>{importItem.creditCardLastFourDigits || "N/A"}</td>
      <td>{importItem.paymentMonth || "N/A"}</td>
      <td>{importItem.originalFileName}</td>
      <td>
        <Chip
          label={importItem.status}
          color={getStatusColor(importItem.status)}
          size="small"
        />
      </td>
      <td style={{ textAlign: "center" }}>
        {importItem.isVerified ? (
          <CheckCircle color="success" />
        ) : (
          <Cancel color="warning" />
        )}
      </td>
      <td>{formatDate(importItem.createdAt, true)}</td>
      <td>{formatDate(importItem.updatedAt, true)}</td>
      <td style={{ textAlign: "center" }}>
        <Box sx={{ display: "flex", justifyContent: "center", gap: 0.5 }}>
          {importItem.status === ImportStatus.COMPLETED && !importItem.isVerified && (
            <IconButton
              size="small"
              color="primary"
              disabled={isRematching}
              onClick={(e) => {
                e.stopPropagation();
                onRematchClick(importItem);
              }}
              title="Re-match"
            >
              <Refresh fontSize="small" />
            </IconButton>
          )}
          <IconButton
            size="small"
            color="error"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteClick(importItem);
            }}
          >
            <Delete fontSize="small" />
          </IconButton>
        </Box>
      </td>
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
  const deleteImportMutation = useDeleteImportMutation();
  const rematchImportMutation = useRematchImportMutation();
  const isMobile = useIsMobile();

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<Import | null>(null);

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [paymentMonthFilter, setPaymentMonthFilter] = useState<string>("ALL");
  const [cardFilter, setCardFilter] = useState<string>("ALL");
  const [isVerifiedFilter, setIsVerifiedFilter] = useState<"ALL" | "true" | "false">("ALL");

  // Sort state
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Derive unique filter options from data
  const filterOptions = useMemo(() => {
    const paymentMonths = Array.from(
      new Set(imports.map((i) => i.paymentMonth).filter(Boolean))
    ).sort() as string[];
    const cards = Array.from(
      new Set(
        imports.map((i) => i.creditCardLastFourDigits).filter(Boolean)
      )
    ).sort() as string[];
    return { paymentMonths, cards };
  }, [imports]);

  // Filtered + sorted list
  const filteredImports = useMemo(() => {
    let result = imports.filter((imp) => {
      if (statusFilter !== "ALL" && imp.status !== statusFilter) return false;
      if (
        paymentMonthFilter !== "ALL" &&
        imp.paymentMonth !== paymentMonthFilter
      )
        return false;
      if (
        cardFilter !== "ALL" &&
        imp.creditCardLastFourDigits !== cardFilter
      )
        return false;
      if (
        isVerifiedFilter !== "ALL" &&
        imp.isVerified !== (isVerifiedFilter === "true")
      )
        return false;
      return true;
    });

    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "createdAt":
          cmp =
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case "paymentMonth":
          cmp = (a.paymentMonth || "").localeCompare(b.paymentMonth || "");
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });

    return result;
  }, [imports, statusFilter, paymentMonthFilter, cardFilter, isVerifiedFilter, sortField, sortDirection]);

  const handleSortClick = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleDeleteConfirm = () => {
    if (deleteTarget) {
      deleteImportMutation.mutate(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  if (isLoading) {
    return <ImportListSkeleton rows={6} />;
  }

  if (!imports.length) {
    return <EmptyState message="No imports found." />;
  }

  const filterBar = (
    <Stack
      direction={isMobile ? "column" : "row"}
      spacing={1.5}
      sx={{ p: 2 }}
    >
      <FormControl size="small" sx={{ minWidth: 130 }}>
        <InputLabel>Status</InputLabel>
        <Select
          value={statusFilter}
          label="Status"
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <MenuItem value="ALL">All</MenuItem>
          {Object.values(ImportStatus).map((s) => (
            <MenuItem key={s} value={s}>
              {s}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl size="small" sx={{ minWidth: 150 }}>
        <InputLabel>Payment Month</InputLabel>
        <Select
          value={paymentMonthFilter}
          label="Payment Month"
          onChange={(e) => setPaymentMonthFilter(e.target.value)}
        >
          <MenuItem value="ALL">All</MenuItem>
          {filterOptions.paymentMonths.map((m) => (
            <MenuItem key={m} value={m}>
              {m}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl size="small" sx={{ minWidth: 140 }}>
        <InputLabel>Card (Last 4)</InputLabel>
        <Select
          value={cardFilter}
          label="Card (Last 4)"
          onChange={(e) => setCardFilter(e.target.value)}
        >
          <MenuItem value="ALL">All</MenuItem>
          {filterOptions.cards.map((c) => (
            <MenuItem key={c} value={c}>
              {c}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <ToggleButtonGroup
        value={isVerifiedFilter}
        exclusive
        size="small"
        onChange={(_, newValue) => {
          if (newValue !== null) setIsVerifiedFilter(newValue);
        }}
      >
        <ToggleButton value="ALL">All</ToggleButton>
        <ToggleButton value="true">Verified</ToggleButton>
        <ToggleButton value="false">Not Verified</ToggleButton>
      </ToggleButtonGroup>
    </Stack>
  );

  const deleteDialog = (
    <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
      <DialogTitle>Delete Import</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Are you sure you want to delete the import &quot;
          {deleteTarget?.originalFileName}&quot;? This action cannot be undone.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
        <Button
          variant="contained"
          color="error"
          onClick={handleDeleteConfirm}
          disabled={deleteImportMutation.isPending}
        >
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );

  if (isMobile) {
    return (
      <>
        {filterBar}
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
              {filteredImports.map((importItem) => (
                <React.Fragment key={importItem.id}>
                  <ImportRowMobile
                    importItem={importItem}
                    onImportClick={onImportClick}
                    isExpanded={expandedImportId === importItem.id}
                    onDeleteClick={setDeleteTarget}
                    onRematchClick={(imp) => rematchImportMutation.mutate(imp.id)}
                    isRematching={rematchImportMutation.isPending}
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
                            <ImportedTransactionList
                              importId={importItem.id}
                            />
                          </Box>
                        </Collapse>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {filteredImports.length === 0 && (
                <tr>
                  <td style={{ padding: "2rem", textAlign: "center" }}>
                    <Typography color="text.secondary">
                      No imports match the selected filters.
                    </Typography>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {deleteDialog}
      </>
    );
  }

  return (
    <>
      {filterBar}
      <div className="card-accent" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 48 }}></th>
              <th>Card (Last 4)</th>
              <th
                style={{ cursor: "pointer" }}
                onClick={() => handleSortClick("paymentMonth")}
              >
                Payment Month
                <SortIndicator
                  field="paymentMonth"
                  sortField={sortField}
                  sortDirection={sortDirection}
                />
              </th>
              <th>File Name</th>
              <th
                style={{ cursor: "pointer" }}
                onClick={() => handleSortClick("status")}
              >
                Status
                <SortIndicator
                  field="status"
                  sortField={sortField}
                  sortDirection={sortDirection}
                />
              </th>
              <th>Verified</th>
              <th
                style={{ cursor: "pointer" }}
                onClick={() => handleSortClick("createdAt")}
              >
                Created At
                <SortIndicator
                  field="createdAt"
                  sortField={sortField}
                  sortDirection={sortDirection}
                />
              </th>
              <th>Updated At</th>
              <th style={{ width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
            {filteredImports.map((importItem) => (
              <React.Fragment key={importItem.id}>
                <ImportRowDesktop
                  importItem={importItem}
                  onImportClick={onImportClick}
                  isExpanded={expandedImportId === importItem.id}
                  onDeleteClick={setDeleteTarget}
                  onRematchClick={(imp) => rematchImportMutation.mutate(imp.id)}
                  isRematching={rematchImportMutation.isPending}
                />
                <tr>
                  <td colSpan={9} style={{ padding: 0 }}>
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
            {filteredImports.length === 0 && (
              <tr>
                <td colSpan={9} style={{ padding: "2rem", textAlign: "center" }}>
                  <Typography color="text.secondary">
                    No imports match the selected filters.
                  </Typography>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {deleteDialog}
    </>
  );
}
